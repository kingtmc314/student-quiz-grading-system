import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accountAuditLogs,
  type AccountRole,
  type InsertUser,
  type SafeAccount,
  type SafeAccountAuditLog,
  studentReportExports,
  studentTopicProgress,
  type StudentTopicProgressStatus,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./passwords";

const TEMPORARY_PASSWORD_TTL_MS = 48 * 60 * 60 * 1000;
/** Student default passwords are always <student number>hoyu unless an administrator resets them. */
export const STUDENT_DEFAULT_PASSWORD_SUFFIX = "hoyu";
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

const normalizeUsername = (username: string) => username.trim().toLowerCase();
export const normalizeStudentNumber = (studentNumber: string) => studentNumber.trim().toLocaleUpperCase();
export const getStudentDefaultPassword = (studentNumber: string) => `${normalizeStudentNumber(studentNumber)}${STUDENT_DEFAULT_PASSWORD_SUFFIX}`;
const nextTemporaryPasswordExpiry = () => new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS);

function toSafeAccount(account: User): SafeAccount {
  const { passwordHash: _passwordHash, openId: _openId, email: _email, loginMethod: _loginMethod, ...safeAccount } = account;
  return safeAccount;
}

function accountLabel(account: Pick<User, "name" | "username"> | undefined): string {
  return account?.name?.trim() || account?.username || "已刪除帳戶";
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  return db;
}

async function recordAccountAudit(input: { actorUserId?: number | null; targetUserId: number; action: string; details?: Record<string, string | number | boolean | null> }) {
  const db = await requireDb();
  await db.insert(accountAuditLogs).values({
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId,
    action: input.action,
    details: input.details ? JSON.stringify(input.details) : null,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/** Compatibility helper retained for the WebDev OAuth scaffold. */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = {};
  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.email !== undefined) { values.email = user.email; updateSet.email = user.email; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }
  if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function ensureInitialAdmin(): Promise<void> {
  const username = normalizeUsername(ENV.initialAdminUsername);
  const password = ENV.initialAdminPassword;
  if (!username || !password) return;

  const db = await requireDb();
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing[0]) {
    if (existing[0].mustChangePassword && !existing[0].temporaryPasswordExpiresAt) {
      await db.update(users).set({ temporaryPasswordExpiresAt: nextTemporaryPasswordExpiry() }).where(eq(users.id, existing[0].id));
    }
    return;
  }

  const passwordHash = await hashPassword(password);
  const expiry = nextTemporaryPasswordExpiry();
  await db.insert(users).values({
    openId: `local:${username}`,
    username,
    passwordHash,
    name: ENV.initialAdminName || "System Administrator",
    loginMethod: "local",
    role: "admin",
    active: true,
    mustChangePassword: true,
    temporaryPasswordExpiresAt: expiry,
    lastSignedIn: new Date(),
  });
  const created = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (created[0]) await recordAccountAudit({ targetUserId: created[0].id, action: "initial_admin_created", details: { role: "admin", temporaryPasswordExpiresAt: expiry.toISOString() } });
}

export type LocalAuthenticationResult =
  | { status: "authenticated"; account: User }
  | { status: "invalid" | "temporary_password_expired" };

export async function authenticateLocalAccount(usernameInput: string, password: string): Promise<LocalAuthenticationResult> {
  const db = await requireDb();
  const username = normalizeUsername(usernameInput);
  const accounts = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const account = accounts[0];
  if (!account || !account.active || !account.passwordHash || !(await verifyPassword(password, account.passwordHash))) return { status: "invalid" };

  if (account.mustChangePassword && account.temporaryPasswordExpiresAt && account.temporaryPasswordExpiresAt.getTime() <= Date.now()) {
    await recordAccountAudit({ targetUserId: account.id, action: "temporary_password_expired", details: { username: account.username ?? "" } });
    return { status: "temporary_password_expired" };
  }

  const signedInAt = new Date();
  await db.update(users).set({ lastSignedIn: signedInAt }).where(eq(users.id, account.id));
  await recordAccountAudit({ actorUserId: account.id, targetUserId: account.id, action: "login_success", details: { role: account.role } });
  return { status: "authenticated", account: { ...account, lastSignedIn: signedInAt } };
}

export async function listManagedAccounts(): Promise<SafeAccount[]> {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.loginMethod, "local")).orderBy(asc(users.role), asc(users.username));
  return rows.map(toSafeAccount);
}

export async function listStudentLoginAccounts(): Promise<SafeAccount[]> {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.role, "student")).orderBy(asc(users.studentNumber), asc(users.username));
  return rows.map(toSafeAccount);
}

async function ensureAvailableUsername(db: Awaited<ReturnType<typeof requireDb>>, username: string) {
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists.length > 0) throw new Error("Username is already in use");
}

export async function createTeacherAccount(input: { username: string; password: string; name: string; actorUserId: number }): Promise<SafeAccount> {
  const db = await requireDb();
  const username = normalizeUsername(input.username);
  await ensureAvailableUsername(db, username);
  const passwordHash = await hashPassword(input.password);
  const expiry = nextTemporaryPasswordExpiry();
  await db.insert(users).values({
    openId: `local:${username}`, username, passwordHash, name: input.name.trim(), loginMethod: "local", role: "teacher", active: true,
    mustChangePassword: true, temporaryPasswordExpiresAt: expiry, lastSignedIn: new Date(),
  });
  const created = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!created[0]) throw new Error("Teacher account could not be created");
  await recordAccountAudit({ actorUserId: input.actorUserId, targetUserId: created[0].id, action: "teacher_account_created", details: { username, temporaryPasswordExpiresAt: expiry.toISOString() } });
  return toSafeAccount(created[0]);
}

/** Legacy record-ID pairing, retained solely for existing integrations. New student accounts use createStudentLoginByNumber. */
export async function createStudentAccount(input: { username: string; password: string; name: string; studentId: string; actorUserId: number }): Promise<SafeAccount> {
  const db = await requireDb();
  const username = normalizeUsername(input.username);
  const studentId = input.studentId.trim();
  if (!studentId) throw new Error("A linked student record is required");
  await ensureAvailableUsername(db, username);
  const linked = await db.select({ id: users.id }).from(users).where(eq(users.studentId, studentId)).limit(1);
  if (linked.length > 0) throw new Error("This student record is already linked to an account");

  const passwordHash = await hashPassword(input.password);
  const expiry = nextTemporaryPasswordExpiry();
  await db.insert(users).values({
    openId: `local:${username}`, username, passwordHash, studentId, name: input.name.trim(), loginMethod: "local", role: "student", active: true,
    mustChangePassword: true, temporaryPasswordExpiresAt: expiry, lastSignedIn: new Date(),
  });
  const created = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!created[0]) throw new Error("Student account could not be created");
  await recordAccountAudit({ actorUserId: input.actorUserId, targetUserId: created[0].id, action: "legacy_student_record_linked", details: { username, studentId, temporaryPasswordExpiresAt: expiry.toISOString() } });
  return toSafeAccount(created[0]);
}

/** Creates one login identity for every occurrence of the same school-wide student number. */
export async function createStudentLoginByNumber(input: { studentNumber: string; name: string; representativeStudentId?: string; actorUserId: number }): Promise<SafeAccount> {
  const db = await requireDb();
  const studentNumber = normalizeStudentNumber(input.studentNumber);
  if (studentNumber.length < 6) throw new Error("Student number must contain at least 6 characters to use the default password rule");

  const matchingAccount = await db.select({ id: users.id }).from(users).where(eq(users.studentNumber, studentNumber)).limit(1);
  if (matchingAccount.length > 0) throw new Error("This student number already has a login account");

  const username = normalizeUsername(studentNumber);
  await ensureAvailableUsername(db, username);
  const passwordHash = await hashPassword(getStudentDefaultPassword(studentNumber));
  await db.insert(users).values({
    openId: `local:${username}`,
    username,
    passwordHash,
    studentId: input.representativeStudentId?.trim() || null,
    studentNumber,
    name: input.name.trim(),
    loginMethod: "local",
    role: "student",
    active: true,
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    lastSignedIn: new Date(),
  });
  const created = await db.select().from(users).where(eq(users.studentNumber, studentNumber)).limit(1);
  if (!created[0]) throw new Error("Student login account could not be created");
  await recordAccountAudit({
    actorUserId: input.actorUserId,
    targetUserId: created[0].id,
    action: "student_login_created_by_number",
    details: { username, studentNumber, passwordPolicy: "default_password" },
  });
  return toSafeAccount(created[0]);
}

export type StudentLoginBatchCandidate = {
  studentNumber: string;
  name: string;
  representativeStudentId?: string;
};

export type StudentLoginBatchResult = {
  created: SafeAccount[];
  skipped: Array<{ studentNumber: string; reason: string }>;
};

/**
 * Creates only missing student-number login accounts. Existing records are
 * skipped (never reset or overwritten), making repeated submissions safe.
 */
export async function createStudentLoginsBatch(input: {
  candidates: StudentLoginBatchCandidate[];
  actorUserId: number;
}): Promise<StudentLoginBatchResult> {
  const db = await requireDb();
  const uniqueCandidates = new Map<string, StudentLoginBatchCandidate>();
  const skipped: StudentLoginBatchResult["skipped"] = [];

  for (const candidate of input.candidates) {
    const studentNumber = normalizeStudentNumber(candidate.studentNumber);
    const name = candidate.name.trim();
    if (studentNumber.length < 6) {
      skipped.push({ studentNumber: candidate.studentNumber.trim() || "—", reason: "學生編號少於 6 個字元" });
      continue;
    }
    if (!name) {
      skipped.push({ studentNumber, reason: "缺少學生姓名" });
      continue;
    }
    if (uniqueCandidates.has(studentNumber)) {
      skipped.push({ studentNumber, reason: "批次名單中重複；只保留第一筆" });
      continue;
    }
    uniqueCandidates.set(studentNumber, { ...candidate, studentNumber, name });
  }

  const created: SafeAccount[] = [];
  for (const candidate of Array.from(uniqueCandidates.values())) {
    const existingByNumber = await db.select({ id: users.id }).from(users).where(eq(users.studentNumber, candidate.studentNumber)).limit(1);
    if (existingByNumber.length > 0) {
      skipped.push({ studentNumber: candidate.studentNumber, reason: "已有學生登入帳戶" });
      continue;
    }
    const username = normalizeUsername(candidate.studentNumber);
    const existingByUsername = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existingByUsername.length > 0) {
      skipped.push({ studentNumber: candidate.studentNumber, reason: "登入帳戶名稱已被使用" });
      continue;
    }
    created.push(await createStudentLoginByNumber({ ...candidate, actorUserId: input.actorUserId }));
  }

  return { created, skipped };
}

/** Removes only the local student login; academic data remains in Supabase untouched. */
export async function deleteStudentLoginAccount(input: { accountId: number; actorUserId: number }): Promise<void> {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.id, input.accountId)).limit(1);
  const account = rows[0];
  if (!account || account.role !== "student") throw new Error("Student login account was not found");
  await recordAccountAudit({
    actorUserId: input.actorUserId,
    targetUserId: account.id,
    action: "student_login_deleted",
    details: { studentNumber: account.studentNumber ?? "", username: account.username ?? "", name: account.name ?? "", academicDataPreserved: true },
  });
  await db.delete(users).where(eq(users.id, account.id));
}

export async function resetStudentDefaultPassword(input: { accountId: number; actorUserId: number }): Promise<SafeAccount> {
  const db = await requireDb();
  const target = await db.select().from(users).where(eq(users.id, input.accountId)).limit(1);
  const account = target[0];
  if (!account || account.role !== "student" || !account.studentNumber) throw new Error("This account is not a student-number login");
  await db.update(users).set({
    passwordHash: await hashPassword(getStudentDefaultPassword(account.studentNumber)),
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
  }).where(eq(users.id, account.id));
  await recordAccountAudit({
    actorUserId: input.actorUserId,
    targetUserId: account.id,
    action: "student_default_password_reset",
    details: { studentNumber: account.studentNumber, passwordPolicy: "default_password" },
  });
  return toSafeAccount({ ...account, mustChangePassword: false, temporaryPasswordExpiresAt: null });
}

export async function resetLocalAccountPassword(input: { accountId: number; password: string; actorUserId: number }): Promise<SafeAccount> {
  const db = await requireDb();
  const target = await db.select().from(users).where(eq(users.id, input.accountId)).limit(1);
  if (!target[0]) throw new Error("Account was not found");
  const expiry = nextTemporaryPasswordExpiry();
  await db.update(users).set({ passwordHash: await hashPassword(input.password), mustChangePassword: true, temporaryPasswordExpiresAt: expiry }).where(eq(users.id, input.accountId));
  await recordAccountAudit({ actorUserId: input.actorUserId, targetUserId: input.accountId, action: "password_reset", details: { temporaryPasswordExpiresAt: expiry.toISOString() } });
  return toSafeAccount({ ...target[0], mustChangePassword: true, temporaryPasswordExpiresAt: expiry });
}

export async function setLocalAccountActive(input: { accountId: number; active: boolean; actorUserId: number }): Promise<void> {
  const db = await requireDb();
  await db.update(users).set({ active: input.active }).where(eq(users.id, input.accountId));
  await recordAccountAudit({ actorUserId: input.actorUserId, targetUserId: input.accountId, action: input.active ? "account_enabled" : "account_disabled", details: { active: input.active } });
}

export async function changeLocalPassword(accountId: number, currentPassword: string, nextPassword: string): Promise<boolean> {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.id, accountId)).limit(1);
  const account = rows[0];
  if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) return false;
  await db.update(users).set({ passwordHash: await hashPassword(nextPassword), mustChangePassword: false, temporaryPasswordExpiresAt: null }).where(eq(users.id, accountId));
  await recordAccountAudit({ actorUserId: accountId, targetUserId: accountId, action: "password_changed" });
  return true;
}

export async function listAccountAuditLogs(limit = 100): Promise<SafeAccountAuditLog[]> {
  const db = await requireDb();
  const logs = await db.select().from(accountAuditLogs).orderBy(desc(accountAuditLogs.createdAt)).limit(limit);
  const accounts = await db.select({ id: users.id, name: users.name, username: users.username }).from(users);
  const accountById = new Map(accounts.map(account => [account.id, account]));
  return logs.map(log => ({
    id: log.id,
    action: log.action,
    details: log.details,
    createdAt: log.createdAt,
    actorLabel: log.actorUserId ? accountLabel(accountById.get(log.actorUserId)) : "System",
    targetLabel: accountLabel(accountById.get(log.targetUserId)),
  }));
}

/** Returns only the authenticated student's own revision markers. */
export async function listStudentTopicProgress(userId: number): Promise<Array<{ topicKey: string; status: StudentTopicProgressStatus; updatedAt: Date }>> {
  const db = await requireDb();
  const rows = await db.select({
    topicKey: studentTopicProgress.topicKey,
    status: studentTopicProgress.status,
    updatedAt: studentTopicProgress.updatedAt,
  }).from(studentTopicProgress)
    .where(eq(studentTopicProgress.userId, userId))
    .orderBy(desc(studentTopicProgress.updatedAt));
  return rows as Array<{ topicKey: string; status: StudentTopicProgressStatus; updatedAt: Date }>;
}

/** Upserts or clears one student-owned revision marker without touching academic data. */
export async function setStudentTopicProgress(input: { userId: number; topicKey: string; status: StudentTopicProgressStatus | null }): Promise<void> {
  const db = await requireDb();
  if (input.status === null) {
    await db.delete(studentTopicProgress).where(and(
      eq(studentTopicProgress.userId, input.userId),
      eq(studentTopicProgress.topicKey, input.topicKey),
    ));
    return;
  }
  await db.insert(studentTopicProgress).values({
    userId: input.userId,
    topicKey: input.topicKey,
    status: input.status,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({ set: { status: input.status, updatedAt: new Date() } });
}

export type StudentReportExportScope = {
  userId: number;
  subjectId: string;
  subjectLabel: string;
  schoolYear: string;
  term: string;
  language: "zh" | "en";
  assessmentIds: string[];
};

/** Stores scope metadata only; the report is recalculated from current protected marks on every re-download. */
export async function recordStudentReportExport(input: StudentReportExportScope): Promise<void> {
  const db = await requireDb();
  const assessmentIds = Array.from(new Set(input.assessmentIds.filter(Boolean))).slice(0, 500);
  if (!assessmentIds.length) throw new Error("At least one assessment is required for a report export record");
  await db.insert(studentReportExports).values({
    userId: input.userId,
    subjectId: input.subjectId,
    subjectLabel: input.subjectLabel,
    schoolYear: input.schoolYear,
    term: input.term,
    language: input.language,
    assessmentIds: JSON.stringify(assessmentIds),
    assessmentCount: assessmentIds.length,
  });
}

/** Returns only the latest 20 export scopes for the authenticated student. */
export async function listStudentReportExports(userId: number) {
  const db = await requireDb();
  const rows = await db.select({
    id: studentReportExports.id,
    subjectId: studentReportExports.subjectId,
    subjectLabel: studentReportExports.subjectLabel,
    schoolYear: studentReportExports.schoolYear,
    term: studentReportExports.term,
    language: studentReportExports.language,
    assessmentIds: studentReportExports.assessmentIds,
    assessmentCount: studentReportExports.assessmentCount,
    createdAt: studentReportExports.createdAt,
  }).from(studentReportExports)
    .where(eq(studentReportExports.userId, userId))
    .orderBy(desc(studentReportExports.createdAt), desc(studentReportExports.id))
    .limit(20);

  return rows.map(row => {
    let assessmentIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.assessmentIds);
      assessmentIds = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 500) : [];
    } catch {
      assessmentIds = [];
    }
    return { ...row, language: row.language === "en" ? "en" as const : "zh" as const, assessmentIds };
  });
}

export function isManagedRole(role: User["role"]): role is AccountRole {
  return role === "admin" || role === "teacher" || role === "student";
}

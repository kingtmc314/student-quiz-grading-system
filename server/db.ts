import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { type AccountRole, type InsertUser, type SafeAccount, type User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./passwords";

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

function toSafeAccount(account: User): SafeAccount {
  const { passwordHash: _passwordHash, openId: _openId, email: _email, loginMethod: _loginMethod, ...safeAccount } = account;
  return safeAccount;
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
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function ensureInitialAdmin(): Promise<void> {
  const username = normalizeUsername(ENV.initialAdminUsername);
  const password = ENV.initialAdminPassword;
  if (!username || !password) return;

  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) return;

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    openId: `local:${username}`,
    username,
    passwordHash,
    name: ENV.initialAdminName || "System Administrator",
    loginMethod: "local",
    role: "admin",
    active: true,
    mustChangePassword: true,
    lastSignedIn: new Date(),
  });
}

export async function authenticateLocalAccount(usernameInput: string, password: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  const username = normalizeUsername(usernameInput);
  const accounts = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const account = accounts[0];
  if (!account || !account.active || !account.passwordHash) return undefined;
  if (!(await verifyPassword(password, account.passwordHash))) return undefined;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, account.id));
  return { ...account, lastSignedIn: new Date() };
}

export async function listManagedAccounts(): Promise<SafeAccount[]> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  const rows = await db.select().from(users).where(eq(users.loginMethod, "local")).orderBy(asc(users.role), asc(users.username));
  return rows.map(toSafeAccount);
}

export async function createTeacherAccount(input: { username: string; password: string; name: string }): Promise<SafeAccount> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  const username = normalizeUsername(input.username);
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists.length > 0) throw new Error("Username is already in use");

  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    openId: `local:${username}`,
    username,
    passwordHash,
    name: input.name.trim(),
    loginMethod: "local",
    role: "teacher",
    active: true,
    mustChangePassword: true,
    lastSignedIn: new Date(),
  });
  const created = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!created[0]) throw new Error("Teacher account could not be created");
  return toSafeAccount(created[0]);
}

export async function resetLocalAccountPassword(accountId: number, password: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true }).where(eq(users.id, accountId));
}

export async function setLocalAccountActive(accountId: number, active: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  await db.update(users).set({ active }).where(eq(users.id, accountId));
}

export async function changeLocalPassword(accountId: number, currentPassword: string, nextPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Account database is unavailable");
  const rows = await db.select().from(users).where(eq(users.id, accountId)).limit(1);
  const account = rows[0];
  if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) return false;
  await db.update(users).set({ passwordHash: await hashPassword(nextPassword), mustChangePassword: false }).where(eq(users.id, accountId));
  return true;
}

export function isManagedRole(role: User["role"]): role is AccountRole {
  return role === "admin" || role === "teacher" || role === "student";
}

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accountAuditLogs, users } from "../drizzle/schema";
import * as db from "./db";

describe("student-number login and account audit", () => {
  it("creates one cross-year student account from a student number and never records its default password", async () => {
    await db.ensureInitialAdmin();
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const admin = await db.getUserByOpenId(`local:${adminUsername}`);
    expect(admin?.role).toBe("admin");

    const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const studentNumber = `SQGS${suffix}`;
    const representativeStudentId = `sqgs-test-student-${suffix}`;
    const defaultPassword = `${studentNumber}hoyu`;
    let createdId: number | undefined;

    try {
      const created = await db.createStudentLoginByNumber({
        studentNumber,
        name: "Student Number Test",
        representativeStudentId,
        actorUserId: admin!.id,
      });
      createdId = created.id;
      expect(created.role).toBe("student");
      expect(created.studentNumber).toBe(studentNumber);
      expect(created.username).toBe(studentNumber.toLowerCase());
      expect(created.mustChangePassword).toBe(false);
      expect(created.temporaryPasswordExpiresAt).toBeNull();

      const login = await db.authenticateLocalAccount(studentNumber, defaultPassword);
      expect(login.status).toBe("authenticated");

      await expect(db.createStudentLoginByNumber({
        studentNumber,
        name: "Duplicate Cross-Year Test",
        representativeStudentId: `same-student-next-year-${suffix}`,
        actorUserId: admin!.id,
      })).rejects.toThrow("already has a login account");

      const reset = await db.resetStudentDefaultPassword({ accountId: created.id, actorUserId: admin!.id });
      expect(reset.studentNumber).toBe(studentNumber);
      expect(reset.mustChangePassword).toBe(false);
      expect(reset.temporaryPasswordExpiresAt).toBeNull();

      const logs = await db.listAccountAuditLogs(100);
      const accountLogs = logs.filter(log => log.targetLabel === "Student Number Test");
      expect(accountLogs.map(log => log.action)).toEqual(expect.arrayContaining(["student_login_created_by_number", "student_default_password_reset"]));
      expect(accountLogs.every(log => !new RegExp(`${defaultPassword}|scrypt\\$`, "i").test(log.details ?? ""))).toBe(true);
    } finally {
      if (createdId) {
        const database = await db.getDb();
        await database?.delete(accountAuditLogs).where(eq(accountAuditLogs.targetUserId, createdId));
        await database?.delete(users).where(eq(users.id, createdId));
      }
    }
  }, 30_000);

  it("batch-creates only missing student logins and deletes login access without touching academic records", async () => {
    await db.ensureInitialAdmin();
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const admin = await db.getUserByOpenId(`local:${adminUsername}`);
    expect(admin?.role).toBe("admin");

    const suffix = randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase();
    const firstNumber = `BATCH${suffix}A`;
    const secondNumber = `BATCH${suffix}B`;
    const createdIds: number[] = [];

    try {
      const result = await db.createStudentLoginsBatch({
        actorUserId: admin!.id,
        candidates: [
          { studentNumber: firstNumber, name: "Batch Student A", representativeStudentId: `student-${suffix}-a` },
          { studentNumber: secondNumber, name: "Batch Student B", representativeStudentId: `student-${suffix}-b` },
          { studentNumber: firstNumber, name: "Duplicate Batch Student" },
        ],
      });
      createdIds.push(...result.created.map(account => account.id));
      expect(result.created).toHaveLength(2);
      expect(result.skipped).toEqual(expect.arrayContaining([expect.objectContaining({ studentNumber: firstNumber })]));
      expect(result.created.every(account => account.mustChangePassword === false && account.temporaryPasswordExpiresAt === null)).toBe(true);

      const login = await db.authenticateLocalAccount(firstNumber, `${firstNumber}hoyu`);
      expect(login.status).toBe("authenticated");

      const firstAccount = result.created.find(account => account.studentNumber === firstNumber);
      expect(firstAccount).toBeDefined();
      await db.deleteStudentLoginAccount({ accountId: firstAccount!.id, actorUserId: admin!.id });
      const deletedLogin = await db.authenticateLocalAccount(firstNumber, `${firstNumber}hoyu`);
      expect(deletedLogin.status).toBe("invalid");

      const logs = await db.listAccountAuditLogs(100);
      expect(logs.some(log => log.action === "student_login_deleted" && (log.details ?? "").includes(firstNumber))).toBe(true);
    } finally {
      const database = await db.getDb();
      for (const id of createdIds) {
        await database?.delete(accountAuditLogs).where(eq(accountAuditLogs.targetUserId, id));
        await database?.delete(users).where(eq(users.id, id));
      }
    }
  }, 30_000);
});

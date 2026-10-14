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
      expect(created.mustChangePassword).toBe(true);
      expect(created.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(Date.now());

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
      expect(reset.mustChangePassword).toBe(true);
      expect(reset.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(Date.now());

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
});

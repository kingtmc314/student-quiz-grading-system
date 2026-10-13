import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accountAuditLogs, users } from "../drizzle/schema";
import * as db from "./db";

describe("student account pairing and account audit", () => {
  it("locks one student record to one account, expires temporary credentials, and records no password data", async () => {
    await db.ensureInitialAdmin();
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const admin = await db.getUserByOpenId(`local:${adminUsername}`);
    expect(admin?.role).toBe("admin");

    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const username = `student.test.${suffix}`;
    const studentId = `sqgs-test-student-${suffix}`;
    let createdId: number | undefined;

    try {
      const created = await db.createStudentAccount({
        username,
        password: "TestTemporary9!",
        name: "Student Account Test",
        studentId,
        actorUserId: admin!.id,
      });
      createdId = created.id;
      expect(created.role).toBe("student");
      expect(created.studentId).toBe(studentId);
      expect(created.mustChangePassword).toBe(true);
      expect(created.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(Date.now());

      await expect(db.createStudentAccount({
        username: `duplicate.${suffix}`,
        password: "TestTemporary9!",
        name: "Duplicate Link Test",
        studentId,
        actorUserId: admin!.id,
      })).rejects.toThrow("already linked");

      const reset = await db.resetLocalAccountPassword({ accountId: created.id, password: "RenewedTemporary9!", actorUserId: admin!.id });
      expect(reset.temporaryPasswordExpiresAt?.getTime()).toBeGreaterThan(Date.now());

      const logs = await db.listAccountAuditLogs(100);
      const accountLogs = logs.filter(log => log.targetLabel === "Student Account Test");
      expect(accountLogs.map(log => log.action)).toEqual(expect.arrayContaining(["student_account_linked", "password_reset"]));
      expect(accountLogs.every(log => !/TestTemporary9|RenewedTemporary9|scrypt\$/i.test(log.details ?? ""))).toBe(true);
    } finally {
      if (createdId) {
        const database = await db.getDb();
        await database?.delete(accountAuditLogs).where(eq(accountAuditLogs.targetUserId, createdId));
        await database?.delete(users).where(eq(users.id, createdId));
      }
    }
  });
});

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import { accountAuditLogs, users } from "../drizzle/schema";

describe("teacher account administration", () => {
  it("allows the initial administrator to retrieve safe account records without password hashes", async () => {
    await db.ensureInitialAdmin();
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    expect(username).toBeTruthy();
    const admin = await db.getUserByOpenId(`local:${username}`);
    expect(admin?.role).toBe("admin");

    const ctx: TrpcContext = {
      user: admin ?? null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const accounts = await appRouter.createCaller(ctx).accounts.list();

    expect(accounts.some(account => account.id === admin?.id && account.role === "admin")).toBe(true);
    expect(accounts.every(account => !("passwordHash" in account))).toBe(true);
  });

  it("creates a teacher account with a temporary password and records a password-safe audit event", async () => {
    await db.ensureInitialAdmin();
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const admin = await db.getUserByOpenId(`local:${adminUsername}`);
    expect(admin?.role).toBe("admin");
    const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
    const username = `teacher.${suffix}`;
    const password = `Strong-${suffix}-Pass`;
    let createdId: number | undefined;

    try {
      const created = await db.createTeacherAccount({
        username,
        password,
        name: "Teacher Creation Test",
        actorUserId: admin!.id,
      });
      createdId = created.id;
      expect(created.role).toBe("teacher");
      expect(created.username).toBe(username);
      expect(created.mustChangePassword).toBe(true);
      expect(created.temporaryPasswordExpiresAt).toBeInstanceOf(Date);

      const login = await db.authenticateLocalAccount(username, password);
      expect(login.status).toBe("authenticated");
      const audit = await db.listAccountAuditLogs(100);
      const record = audit.find(event => event.action === "teacher_account_created" && event.targetLabel === "Teacher Creation Test");
      expect(record).toBeDefined();
      expect(record?.details).not.toContain(password);
      expect(record?.details).not.toMatch(/scrypt\$/i);
    } finally {
      if (createdId) {
        const database = await db.getDb();
        await database?.delete(accountAuditLogs).where(eq(accountAuditLogs.targetUserId, createdId));
        await database?.delete(users).where(eq(users.id, createdId));
      }
    }
  }, 30_000);
});

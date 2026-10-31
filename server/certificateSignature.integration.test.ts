import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accountAuditLogs, teacherCertificateSignatures, users } from "../drizzle/schema";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

describe("teacher certificate signature settings", () => {
  it("stores only the signed-in teacher's signature reference and display name", async () => {
    await db.ensureInitialAdmin();
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim().toLowerCase();
    const admin = await db.getUserByOpenId(`local:${adminUsername}`);
    expect(admin?.role).toBe("admin");

    const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
    const username = `signature.${suffix}`;
    let teacherId: number | undefined;

    try {
      const created = await db.createTeacherAccount({
        username,
        password: `Strong-${suffix}-Pass`,
        name: "Certificate Signature Test",
        actorUserId: admin!.id,
      });
      teacherId = created.id;
      const teacher = await db.getUserByOpenId(`local:${username}`);
      expect(teacher?.role).toBe("teacher");

      const ctx: TrpcContext = {
        user: teacher ?? null,
        req: {} as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);
      expect(await caller.certificateSignature.mine()).toBeNull();

      const saved = await caller.certificateSignature.save({
        signerName: "陳老師",
        clearImage: false,
      });
      expect(saved.signerName).toBe("陳老師");
      expect(saved.signatureKey).toBeNull();
      expect(saved.signatureUrl).toBeNull();

      const reread = await caller.certificateSignature.mine();
      expect(reread?.signerName).toBe("陳老師");
      const audit = await db.listAccountAuditLogs(100);
      const update = audit.find(item => item.action === "certificate_signature_updated" && item.targetLabel === "Certificate Signature Test");
      expect(update?.details).toContain("hasSignatureImage");
      expect(update?.details).not.toContain("password");
    } finally {
      if (teacherId) {
        const database = await db.getDb();
        await database?.delete(teacherCertificateSignatures).where(eq(teacherCertificateSignatures.userId, teacherId));
        await database?.delete(accountAuditLogs).where(eq(accountAuditLogs.targetUserId, teacherId));
        await database?.delete(users).where(eq(users.id, teacherId));
      }
    }
  }, 30_000);
});

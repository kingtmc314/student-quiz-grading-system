import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

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
});

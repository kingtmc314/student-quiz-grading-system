import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/** Validates supplied bootstrap credentials through the actual tRPC login endpoint without logging secrets. */
describe("local administrator authentication", () => {
  it("accepts the configured initial administrator credentials and sets an HTTP-only session", async () => {
    const username = process.env.INITIAL_ADMIN_USERNAME;
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    expect(username).toBeTruthy();
    expect(password).toBeTruthy();

    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: { "x-forwarded-proto": "https" } } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
        clearCookie: () => undefined,
      } as unknown as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.login({ username: username!, password: password! })).resolves.toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("app_session_id");
    expect(cookies[0]?.value.length).toBeGreaterThan(40);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none" });
  });
});

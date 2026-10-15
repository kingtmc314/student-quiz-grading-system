import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
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
    const result = await caller.auth.login({ username: username!, password: password! });
    expect(result.success).toBe(true);
    expect(result.fallbackSessionToken.length).toBeGreaterThan(40);
    expect(await sdk.verifySession(result.fallbackSessionToken)).toMatchObject({ openId: `local:${username!.trim().toLowerCase()}` });
    await expect(sdk.authenticateRequest({ headers: { authorization: `Bearer ${result.fallbackSessionToken}` } } as TrpcContext["req"])).resolves.toMatchObject({
      openId: `local:${username!.trim().toLowerCase()}`,
      role: "admin",
    });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe("app_session_id");
    expect(cookies[0]?.value.length).toBeGreaterThan(40);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });
});

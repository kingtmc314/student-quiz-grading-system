import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getOwnStudentProfile } from "./studentProfile";

const usernameSchema = z.string().trim().min(3, "帳戶名稱最少 3 個字元").max(64, "帳戶名稱最多 64 個字元").regex(/^[a-zA-Z0-9._-]+$/, "帳戶名稱只可包含英文字母、數字、句點、底線或連字號");
const passwordSchema = z.string().min(10, "密碼最少 10 個字元").max(128, "密碼最多 128 個字元");
const accountNameSchema = z.string().trim().min(1, "請輸入名稱").max(120);
const studentNumberSchema = z.string().trim().min(6, "學生編號最少 6 個字元，才能符合「學生編號 + hoyu」的預設密碼規則").max(64, "學生編號最多 64 個字元").regex(/^[a-zA-Z0-9._-]+$/, "學生編號只可包含英文字母、數字、句點、底線或連字號");
const BROWSER_FALLBACK_SESSION_MS = 1000 * 60 * 60 * 12;
const reportExportScopeSchema = z.object({
  subjectId: z.string().trim().min(1).max(128),
  schoolYear: z.string().trim().min(1).max(64),
  term: z.string().trim().min(1).max(64),
  language: z.enum(["zh", "en"]),
  assessmentIds: z.array(z.string().trim().min(1).max(128)).min(1).max(500),
});

function assertLocalAccountRole(user: { role: string; active: boolean }) {
  if (!user.active || (user.role !== "admin" && user.role !== "teacher" && user.role !== "student")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "此帳戶沒有系統存取權限" });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure.input(z.object({ username: usernameSchema, password: passwordSchema })).mutation(async ({ ctx, input }) => {
      await db.ensureInitialAdmin();
      const result = await db.authenticateLocalAccount(input.username, input.password);
      if (result.status === "temporary_password_expired") {
        throw new TRPCError({ code: "FORBIDDEN", message: "暫用密碼已逾期，請聯絡管理員重設密碼。" });
      }
      if (result.status !== "authenticated") throw new TRPCError({ code: "UNAUTHORIZED", message: "帳戶名稱、密碼錯誤，或帳戶已停用" });
      assertLocalAccountRole(result.account);

      const sessionToken = await sdk.createSessionToken(result.account.openId, {
        name: result.account.name || result.account.username || "User",
        expiresInMs: ONE_YEAR_MS,
      });
      // iPad Safari, private browsing and embedded browsers can reject a
      // third-party cookie. This short-lived token is used only in the current
      // browser tab as an Authorization-header fallback; the primary session
      // remains the HTTP-only cookie above.
      const fallbackSessionToken = await sdk.createSessionToken(result.account.openId, {
        name: result.account.name || result.account.username || "User",
        expiresInMs: BROWSER_FALLBACK_SESSION_MS,
      });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { success: true, fallbackSessionToken } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: passwordSchema, nextPassword: passwordSchema })).mutation(async ({ ctx, input }) => {
      const changed = await db.changeLocalPassword(ctx.user.id, input.currentPassword, input.nextPassword);
      if (!changed) throw new TRPCError({ code: "UNAUTHORIZED", message: "現有密碼不正確" });
      return { success: true } as const;
    }),
  }),
  accounts: router({
    list: adminProcedure.query(async () => db.listManagedAccounts()),
    auditLog: adminProcedure.query(async () => db.listAccountAuditLogs(100)),
    createTeacher: adminProcedure.input(z.object({ username: usernameSchema, password: passwordSchema, name: accountNameSchema })).mutation(async ({ ctx, input }) => db.createTeacherAccount({ ...input, actorUserId: ctx.user.id })),
    resetPassword: adminProcedure.input(z.object({ accountId: z.number().int().positive(), password: passwordSchema })).mutation(async ({ ctx, input }) => db.resetLocalAccountPassword({ ...input, actorUserId: ctx.user.id })),
    setActive: adminProcedure.input(z.object({ accountId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.accountId && !input.active) throw new TRPCError({ code: "BAD_REQUEST", message: "不能停用目前登入的管理員帳戶" });
      await db.setLocalAccountActive({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  studentLogins: router({
    list: adminProcedure.query(async () => db.listStudentLoginAccounts()),
    createByNumber: adminProcedure.input(z.object({
      studentNumber: studentNumberSchema,
      name: accountNameSchema,
      representativeStudentId: z.string().trim().max(128).optional(),
    })).mutation(async ({ ctx, input }) => db.createStudentLoginByNumber({ ...input, actorUserId: ctx.user.id })),
    createBatch: adminProcedure.input(z.object({
      candidates: z.array(z.object({
        studentNumber: studentNumberSchema,
        name: accountNameSchema,
        representativeStudentId: z.string().trim().max(128).optional(),
      })).min(1, "請至少選擇一名學生").max(500, "一次最多建立 500 個學生帳戶"),
    })).mutation(async ({ ctx, input }) => db.createStudentLoginsBatch({ ...input, actorUserId: ctx.user.id })),
    resetDefaultPassword: adminProcedure.input(z.object({ accountId: z.number().int().positive() })).mutation(async ({ ctx, input }) => db.resetStudentDefaultPassword({ ...input, actorUserId: ctx.user.id })),
    delete: adminProcedure.input(z.object({ accountId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.deleteStudentLoginAccount({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  studentProfile: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "此頁面只供學生帳戶使用" });
      if (!ctx.user.studentNumber) throw new TRPCError({ code: "FORBIDDEN", message: "學生帳戶尚未連結學生編號，請聯絡老師" });
      return getOwnStudentProfile({ studentNumber: ctx.user.studentNumber, name: ctx.user.name });
    }),
    topicProgress: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "此頁面只供學生帳戶使用" });
      return db.listStudentTopicProgress(ctx.user.id);
    }),
    setTopicProgress: protectedProcedure.input(z.object({
      topicKey: z.string().trim().min(1).max(512),
      status: z.enum(["completed", "review"]).nullable(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student" || !ctx.user.studentNumber) throw new TRPCError({ code: "FORBIDDEN", message: "此功能只供已配對的學生帳戶使用" });
      // Accept only a topic already visible in the student's own protected report.
      const profile = await getOwnStudentProfile({ studentNumber: ctx.user.studentNumber, name: ctx.user.name });
      if (!profile?.topics.some(topic => topic.id === input.topicKey)) throw new TRPCError({ code: "BAD_REQUEST", message: "只能標記自己報告內的課題" });
      await db.setStudentTopicProgress({ userId: ctx.user.id, topicKey: input.topicKey, status: input.status });
      return { success: true } as const;
    }),
    reportHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "student" || !ctx.user.studentNumber) throw new TRPCError({ code: "FORBIDDEN", message: "此功能只供已配對的學生帳戶使用" });
      return db.listStudentReportExports(ctx.user.id);
    }),
    recordReportExport: protectedProcedure.input(reportExportScopeSchema).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student" || !ctx.user.studentNumber) throw new TRPCError({ code: "FORBIDDEN", message: "此功能只供已配對的學生帳戶使用" });
      const profile = await getOwnStudentProfile({ studentNumber: ctx.user.studentNumber, name: ctx.user.name });
      const matchingSubject = input.subjectId === "all" ? undefined : profile?.subjects.find(subject => subject.subjectId === input.subjectId);
      if (!profile || (input.subjectId !== "all" && !matchingSubject)) throw new TRPCError({ code: "BAD_REQUEST", message: "匯出範圍包含未授權的科目" });

      const allowedAssessmentIds = new Set(profile.assessments
        .filter(assessment => (input.subjectId === "all" || assessment.subjectId === input.subjectId)
          && (input.schoolYear === "all" || assessment.yearLabel === input.schoolYear)
          && (input.term === "all" || assessment.term === input.term))
        .map(assessment => assessment.id));
      const assessmentIds = Array.from(new Set(input.assessmentIds));
      if (!assessmentIds.every(id => allowedAssessmentIds.has(id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "匯出範圍包含未授權的評估項目" });
      }

      await db.recordStudentReportExport({
        userId: ctx.user.id,
        subjectId: input.subjectId,
        subjectLabel: matchingSubject ? `${matchingSubject.subjectCode} · ${matchingSubject.subjectName}` : "All subjects",
        schoolYear: input.schoolYear,
        term: input.term,
        language: input.language,
        assessmentIds,
      });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;

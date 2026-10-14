import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Application accounts.
 * Passwords are never stored directly: passwordHash contains a salted scrypt hash.
 * `openId` remains for compatibility with the WebDev session framework and uses
 * the `local:<username>` namespace for username/password accounts.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 128 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Legacy anchor for accounts created before student-number-based management. */
  studentId: varchar("studentId", { length: 128 }).unique(),
  /** One school-wide student identifier; one value maps to exactly one student account across all years. */
  studentNumber: varchar("studentNumber", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "teacher", "student"]).default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  /** Applies only to an administrator-issued temporary password, never to the user's chosen password. */
  temporaryPasswordExpiresAt: timestamp("temporaryPasswordExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Security-relevant account events. Details deliberately exclude passwords and password hashes.
 * The table is append-only in application code: no update/delete helper is provided.
 */
export const accountAuditLogs = mysqlTable("accountAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  targetUserId: int("targetUserId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("account_audit_target_created_idx").on(table.targetUserId, table.createdAt),
  index("account_audit_created_idx").on(table.createdAt),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AccountAuditLog = typeof accountAuditLogs.$inferSelect;
export type AccountRole = "admin" | "teacher" | "student";

export type SafeAccount = Pick<
  User,
  "id" | "username" | "name" | "role" | "studentId" | "studentNumber" | "active" | "mustChangePassword" | "temporaryPasswordExpiresAt" | "createdAt" | "updatedAt" | "lastSignedIn"
>;

export type SafeAccountAuditLog = Pick<AccountAuditLog, "id" | "action" | "details" | "createdAt"> & {
  actorLabel: string;
  targetLabel: string;
};

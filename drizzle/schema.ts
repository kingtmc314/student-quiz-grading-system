import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "teacher", "student"]).default("user").notNull(),
  active: boolean("active").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AccountRole = "admin" | "teacher" | "student";

export type SafeAccount = Pick<
  User,
  "id" | "username" | "name" | "role" | "active" | "mustChangePassword" | "createdAt" | "updatedAt" | "lastSignedIn"
>;

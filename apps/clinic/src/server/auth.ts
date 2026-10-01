import "server-only"

import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { admin, username } from "better-auth/plugins"

import { ac, roles } from "@/lib/permissions"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { logger } from "@/server/logger"

const SIGN_IN_PATHS = new Set(["/sign-in/username", "/sign-in/email"])

/**
 * The only auth endpoints the browser may call. Everything else — notably the
 * admin plugin's /admin/* endpoints (set-role, ban, impersonate…) — is reachable
 * only from our own server code, where the users feature enforces its policy.
 */
const BROWSER_ALLOWED_PATHS = new Set([
  "/sign-in/username",
  "/sign-out",
  "/get-session",
  "/change-password",
  "/ok",
])

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Requests from any other origin are rejected (CSRF protection).
  trustedOrigins: [env.BETTER_AUTH_URL, ...env.TRUSTED_ORIGINS],
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: {
    database: { generateId: "uuid" },
  },
  // Staff log in with username + password. Accounts are created by the owner/admin only.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 12, // one working day
    updateAge: 60 * 60,
  },
  rateLimit: {
    enabled: env.AUTH_RATE_LIMIT === "on",
    window: 60,
    max: 100,
    customRules: {
      // Slows down password guessing: 5 attempts per minute per IP.
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await recordAudit(db, {
            userId: session.userId,
            action: "login",
            entity: "session",
            ipAddress: session.ipAddress,
          }).catch((err) => logger.error({ err }, "failed to audit login"))
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Server-side calls (auth.api.* without a request) are trusted; HTTP calls are not.
      if (ctx.request && !BROWSER_ALLOWED_PATHS.has(ctx.path)) {
        throw new APIError("NOT_FOUND")
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (!SIGN_IN_PATHS.has(ctx.path) || !isAPIError(ctx.context.returned)) return
      const body = ctx.body as { username?: unknown; email?: unknown } | undefined
      await recordAudit(db, {
        userId: null,
        action: "login_failed",
        entity: "session",
        after: { username: String(body?.username ?? body?.email ?? "").slice(0, 100) },
        ipAddress: ctx.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      }).catch((err) => logger.error({ err }, "failed to audit failed login"))
    }),
  },
  plugins: [
    username(),
    admin({ ac, roles, defaultRole: "reception", adminRoles: ["owner", "admin"] }),
    nextCookies(), // must stay last
  ],
})

/** Staff often have no email; Better Auth requires one, so derive a local placeholder. */
export function placeholderEmail(username: string) {
  return `${username.toLowerCase()}@staff.clinic.local`
}

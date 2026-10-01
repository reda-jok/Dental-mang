import "server-only"

import { z } from "zod"

// Validated once at startup; the app refuses to boot with a bad environment.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  // Extra addresses the clinic's devices use to reach this server, comma-separated
  // (e.g. "http://192.168.1.10:3100,http://clinic.local"). Set by the appliance installer.
  TRUSTED_ORIGINS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  // Login rate limiting. Can only be turned off outside production (e2e tests).
  AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),
  CLINIC_TIMEZONE: z.string().default("Asia/Baghdad"),
  // Where X-rays, photos and documents are stored (included in backups).
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
})

export const env = schema
  .refine((e) => e.NODE_ENV !== "production" || e.AUTH_RATE_LIMIT === "on", {
    message: "AUTH_RATE_LIMIT cannot be turned off in production",
  })
  .parse(process.env)

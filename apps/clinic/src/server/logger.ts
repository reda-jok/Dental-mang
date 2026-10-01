import "server-only"

import pino from "pino"

import { env } from "@/server/env"

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ["password", "*.password", "headers.cookie", "headers.authorization"],
})

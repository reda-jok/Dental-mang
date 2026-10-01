import "server-only"

import { env } from "@/server/env"
import { toActionError } from "@/server/action"

/**
 * CSRF protection for route handlers (server actions get this from Next.js):
 * a state-changing request must come from one of our own origins.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  const allowed = new Set([
    new URL(request.url).origin,
    env.BETTER_AUTH_URL,
    ...env.TRUSTED_ORIGINS,
  ])
  return allowed.has(origin)
}

const STATUS = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
} as const

/** Same error shape as server actions, with a matching HTTP status. */
export function errorResponse(error: unknown) {
  const result = toActionError(error)
  return Response.json(result, { status: STATUS[result.code] })
}

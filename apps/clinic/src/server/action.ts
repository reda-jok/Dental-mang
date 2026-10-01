import "server-only"

import { unstable_rethrow } from "next/navigation"
import { z } from "zod"

import type { Permission } from "@/lib/permissions"
import { AppError, type ActionResult } from "@/server/errors"
import { logger } from "@/server/logger"
import { authorize, type CurrentUser } from "@/server/session"

type Options<S extends z.ZodType, T, P extends Permission | "public"> = {
  schema: S
  /** Required on purpose: an action is either guarded by a permission or explicitly public. */
  permission: P
  handler: (
    input: z.output<S>,
    ctx: { user: P extends "public" ? null : CurrentUser },
  ) => Promise<T>
}

/**
 * Wraps a server action: validate input → check permission → run → map errors.
 * Unknown errors are logged with a request id and never shown to the user.
 */
export function defineAction<S extends z.ZodType, T, P extends Permission | "public">(
  options: Options<S, T, P>,
) {
  return async (input: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = options.permission === "public" ? null : await authorize(options.permission)
      const parsed = options.schema.parse(input)
      const data = await options.handler(parsed, { user } as {
        user: P extends "public" ? null : CurrentUser
      })
      return { ok: true, data }
    } catch (error) {
      unstable_rethrow(error) // let redirect()/notFound() through
      return toActionError(error)
    }
  }
}

export function toActionError(error: unknown): Extract<ActionResult<never>, { ok: false }> {
  if (error instanceof AppError) {
    return {
      ok: false,
      code: error.code,
      message: error.message, // a specific key when given, else the code
      fieldErrors: error.fieldErrors,
    }
  }
  if (error instanceof z.ZodError) {
    const { fieldErrors } = z.flattenError(error)
    return {
      ok: false,
      code: "validation",
      message: "validation",
      fieldErrors: fieldErrors as Record<string, string[]>,
    }
  }
  if (isUniqueViolation(error)) {
    return { ok: false, code: "conflict", message: "conflict" }
  }
  const requestId = crypto.randomUUID()
  logger.error({ err: error, requestId }, "unhandled action error")
  return { ok: false, code: "internal", message: "internal", requestId }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  )
}

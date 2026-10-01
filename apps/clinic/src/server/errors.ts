// Typed errors thrown by services. Only these reach the user; anything else becomes "internal".

export type AppErrorCode =
  "unauthenticated" | "forbidden" | "not_found" | "validation" | "conflict" | "internal"

export class AppError extends Error {
  /**
   * @param code     category (decides the generic message and HTTP-like meaning)
   * @param message  optional specific translation key under "errors", e.g. "lastOwner"
   */
  constructor(
    readonly code: AppErrorCode,
    message?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message ?? code)
    this.name = "AppError"
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: AppErrorCode
      /** A translation key under "errors", never a raw internal message. */
      message: string
      fieldErrors?: Record<string, string[]>
      requestId?: string
    }

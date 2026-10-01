import { describe, expect, it } from "vitest"
import { z } from "zod"

import { toActionError } from "./action"
import { AppError } from "./errors"

describe("toActionError", () => {
  it("passes AppError codes through", () => {
    expect(toActionError(new AppError("forbidden"))).toMatchObject({ ok: false, code: "forbidden" })
  })

  it("turns Zod errors into field errors", () => {
    const result = z.object({ name: z.string().min(2, "tooShort") }).safeParse({ name: "a" })
    expect(result.success).toBe(false)
    expect(toActionError(result.error)).toMatchObject({
      code: "validation",
      fieldErrors: { name: ["tooShort"] },
    })
  })

  it("maps unique-constraint violations to conflict", () => {
    expect(toActionError({ code: "P2002" })).toMatchObject({ code: "conflict" })
  })

  it("hides unknown errors behind a request id", () => {
    const result = toActionError(new Error('relation "patient" does not exist'))
    expect(result.code).toBe("internal")
    expect(result.message).toBe("internal")
    expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.stringify(result)).not.toContain("relation")
  })
})

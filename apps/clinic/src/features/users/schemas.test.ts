import { describe, expect, it } from "vitest"

import { createUserSchema } from "./schemas"

describe("createUserSchema", () => {
  const withSignIn = {
    canSignIn: true,
    name: "سارة",
    role: "reception",
    username: "sara",
    password: "blue-river-77",
    confirmPassword: "blue-river-77",
  }

  it("needs a username and matching passwords for someone who signs in", () => {
    expect(createUserSchema.safeParse(withSignIn).success).toBe(true)
    const mismatch = createUserSchema.safeParse({ ...withSignIn, confirmPassword: "other-pass-12" })
    expect(mismatch.error?.issues[0]?.message).toBe("passwordMismatch")
    expect(createUserSchema.safeParse({ ...withSignIn, username: undefined }).success).toBe(false)
  })

  it("takes only a name and role for someone who doesn't sign in", () => {
    const parsed = createUserSchema.parse({ canSignIn: false, name: "نور", role: "assistant" })
    expect(parsed).toEqual({ canSignIn: false, name: "نور", role: "assistant" })
    // No credentials can sneak in with an employee who doesn't sign in.
    const sneaky = { canSignIn: false, name: "نور", role: "assistant", password: "blue-river-77" }
    expect(createUserSchema.safeParse(sneaky).success).toBe(false)
  })
})

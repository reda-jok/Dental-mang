import { z } from "zod"

import { ROLE_NAMES } from "@/lib/permissions"
import { password, text, username, uuid } from "@/lib/validation"

const role = z.enum(ROLE_NAMES as [string, ...string[]], { error: "required" })

type PasswordFields = { password: string; confirmPassword: string }

const withPasswordChecks = <S extends z.ZodType<PasswordFields>>(
  schema: S,
  usernameOf?: (v: z.output<S>) => string,
) =>
  schema
    .refine((v) => v.password === v.confirmPassword, {
      path: ["confirmPassword"],
      message: "passwordMismatch",
    })
    .refine((v) => !usernameOf || !v.password.toLowerCase().includes(usernameOf(v)), {
      path: ["password"],
      message: "passwordContainsUsername",
    })

export const createUserSchema = withPasswordChecks(
  z.strictObject({
    name: text(2, 100),
    username,
    role,
    password,
    confirmPassword: z.string(),
  }),
  (v) => v.username,
)

export const updateUserSchema = z.strictObject({
  id: uuid,
  name: text(2, 100),
  role,
})

export const setUserActiveSchema = z.strictObject({
  id: uuid,
  active: z.boolean(),
})

export const resetPasswordSchema = withPasswordChecks(
  z.strictObject({
    id: uuid,
    password,
    confirmPassword: z.string(),
  }),
)

export type CreateUserInput = z.input<typeof createUserSchema>
export type UpdateUserInput = z.input<typeof updateUserSchema>
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>

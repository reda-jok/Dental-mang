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

const signIn = { username, password, confirmPassword: z.string() }

/**
 * An employee. `canSignIn: false` = someone who doesn't use the system (e.g. a dentist
 * who never logs in but still has appointments and commission): no username or password.
 */
export const createUserSchema = z.discriminatedUnion("canSignIn", [
  withPasswordChecks(
    z.strictObject({ canSignIn: z.literal(true), name: text(2, 100), role, ...signIn }),
    (v) => v.username,
  ),
  z.strictObject({ canSignIn: z.literal(false), name: text(2, 100), role }),
])

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

/** Lets an employee who couldn't sign in use the system from now on. */
export const allowSignInSchema = withPasswordChecks(
  z.strictObject({ id: uuid, ...signIn }),
  (v) => v.username,
)

export type CreateUserInput = z.input<typeof createUserSchema>
export type UpdateUserInput = z.input<typeof updateUserSchema>
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
export type AllowSignInInput = z.input<typeof allowSignInSchema>

import { z } from "zod"

import { password, text, username } from "@/lib/validation"

export const setupSchema = z
  .strictObject({
    clinicName: text(2, 100),
    ownerName: text(2, 100),
    username,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  })
  .refine((v) => !v.password.toLowerCase().includes(v.username), {
    path: ["password"],
    message: "passwordContainsUsername",
  })

export type SetupInput = z.input<typeof setupSchema>

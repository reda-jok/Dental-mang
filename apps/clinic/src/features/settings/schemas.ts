import { z } from "zod"

import {
  optionalMultiline,
  optionalPhone,
  optionalText,
  text,
  toLatinDigits,
} from "@/lib/validation"

export const PRINT_PAPERS = ["A5", "A4"] as const

export const clinicSettingsSchema = z.strictObject({
  name: text(2, 100),
  phone: optionalPhone,
  address: optionalText(200),
  receiptFooter: optionalMultiline(300),
  /** Days a patient has to pay an invoice (sets the default due date). */
  invoiceDueDays: z
    .string({ error: "required" })
    .transform((v) => toLatinDigits(v).trim())
    .pipe(z.string().regex(/^\d{1,3}$/, "invalidDueDays"))
    .transform(Number)
    .refine((n) => n <= 365, "invalidDueDays"),
  /** Paper for prescriptions and quotes. */
  printPaper: z.enum(PRINT_PAPERS),
})

export type ClinicSettingsInput = z.input<typeof clinicSettingsSchema>

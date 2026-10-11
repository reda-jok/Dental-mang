import { z } from "zod"

import { optionalAmountField } from "@/lib/money"
import { toLatinDigits, uuid } from "@/lib/validation"

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** ?month=YYYY-MM (anything else → this month). */
export const monthParams = z.object({
  month: z.string().regex(MONTH).optional().catch(undefined),
})

export const PAY_TYPES = ["commission", "both", "salary"] as const

export const setPaySchema = z
  .strictObject({
    dentistId: uuid,
    payType: z.enum(PAY_TYPES),
    /** Percent, up to two decimals (Arabic digits accepted). */
    commissionRate: z
      .string()
      .transform((v) => toLatinDigits(v).trim().replace("٫", "."))
      .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "invalidRate"))
      .refine((v) => Number(v) <= 100, "invalidRate"),
    monthlySalary: optionalAmountField("IQD"),
    deductLab: z.boolean(),
    /** "YYYY-MM": the first month this applies to. */
    effectiveFrom: z.string().regex(MONTH, "required"),
  })
  .superRefine((v, ctx) => {
    if (v.payType !== "commission" && v.monthlySalary === "0") {
      ctx.addIssue({ code: "custom", path: ["monthlySalary"], message: "required" })
    }
  })

export type SetPayInput = z.input<typeof setPaySchema>

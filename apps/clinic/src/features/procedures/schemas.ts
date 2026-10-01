import { z } from "zod"

import { parseAmount } from "@/lib/money"
import { text, toLatinDigits, uuid } from "@/lib/validation"

import { CONDITION_CODES } from "../chart/teeth"

export const TOOTH_SCOPES = ["none", "tooth", "surfaces"] as const

export const categorySchema = z.strictObject({ name: text(2, 60) })

const procedureFields = z.object({
  name: text(2, 100),
  categoryId: uuid,
  /** Dinars only (decision 2026-10-01). The column keeps the currency for the future. */
  currency: z.literal("IQD"),
  price: z.string({ error: "required" }),
  toothScope: z.enum(TOOTH_SCOPES),
  chartResult: z.union([z.enum(CONDITION_CODES), z.literal("")]).transform((v) => v || null),
  durationMinutes: z
    .string()
    .optional()
    .transform((v) => (v ? toLatinDigits(v).trim() : ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,3}$/, "invalidDuration")]))
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 5 && v <= 600), "invalidDuration"),
  requiresLab: z.boolean(),
})

/** The price is parsed with the currency's decimals, so it's checked on the whole object. */
function withPrice<T extends z.ZodType<z.output<typeof procedureFields>>>(schema: T) {
  return schema.transform((v, ctx) => {
    if (!v.price.trim()) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "required" })
      return z.NEVER
    }
    const price = parseAmount(v.price, v.currency)
    if (price === null) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "invalidAmount" })
      return z.NEVER
    }
    return { ...v, price }
  })
}

export const createProcedureSchema = withPrice(procedureFields.strict())
export const updateProcedureSchema = withPrice(procedureFields.extend({ id: uuid }).strict())
export const archiveProcedureSchema = z.strictObject({ id: uuid })

export type ProcedureFormInput = z.input<typeof procedureFields>

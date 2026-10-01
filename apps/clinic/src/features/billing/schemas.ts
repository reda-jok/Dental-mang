import { z } from "zod"

import { optionalAmountField } from "@/lib/money"
import { isoDate, optionalMultiline, text, toLatinDigits, uuid } from "@/lib/validation"

export const INVOICE_KINDS = ["visit", "plan"] as const

const quantity = z
  .string({ error: "required" })
  .transform((v) => toLatinDigits(v).trim())
  .pipe(z.string().regex(/^\d{1,2}$/, "invalidQuantity"))
  .transform(Number)
  .refine((n) => n >= 1 && n <= 99, "invalidQuantity")

/**
 * One invoice line: a plan item, or a procedure straight from the catalog. Prices are
 * never sent by the browser; the server reads them from the plan or the catalog.
 */
export const invoiceLineSchema = z
  .strictObject({
    planItemId: uuid.optional(),
    procedureId: uuid.optional(),
    quantity,
    discount: optionalAmountField(),
  })
  .refine((line) => !!line.planItemId !== !!line.procedureId, "invalid")

export const createInvoiceSchema = z
  .strictObject({
    patientId: uuid,
    kind: z.enum(INVOICE_KINDS),
    planId: z.union([uuid, z.literal("")]).optional(),
    lines: z.array(invoiceLineSchema).min(1, "noInvoiceLines").max(100),
    extraDiscount: optionalAmountField(),
    dueDate: isoDate,
    notes: optionalMultiline(500),
  })
  .refine((v) => v.kind !== "plan" || !!v.planId, { path: ["planId"], message: "required" })

export const voidInvoiceSchema = z.strictObject({
  id: uuid,
  reason: text(3, 300),
})

export const INVOICE_FILTERS = ["all", "open", "overdue", "void"] as const

export const invoiceSearchSchema = z.object({
  q: z.string().max(100).catch(""),
  status: z.enum(INVOICE_FILTERS).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>

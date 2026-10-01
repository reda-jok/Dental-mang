import { z } from "zod"

import { amountField, optionalAmountField, parseAmount, toMinor } from "@/lib/money"
import {
  isoDate,
  optionalMultiline,
  optionalText,
  text,
  toLatinDigits,
  uuid,
} from "@/lib/validation"

import { PAYMENT_METHODS } from "./payments"

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

export const INVOICE_FILTERS = ["all", "open", "overdue", "paid", "void"] as const

export const invoiceSearchSchema = z.object({
  q: z.string().max(100).catch(""),
  status: z.enum(INVOICE_FILTERS).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>

/** An amount of money received or paid out: whole dinars, more than zero. */
const positiveAmount = z.string({ error: "required" }).transform((v, ctx) => {
  if (!v.trim()) {
    ctx.addIssue({ code: "custom", message: "required" })
    return z.NEVER
  }
  const amount = parseAmount(v, "IQD")
  if (amount === null || toMinor(amount) === 0n) {
    ctx.addIssue({ code: "custom", message: amount === null ? "invalidAmount" : "amountPositive" })
    return z.NEVER
  }
  return amount
})

export const recordPaymentSchema = z.strictObject({
  patientId: uuid,
  amount: positiveAmount,
  method: z.enum(PAYMENT_METHODS, { error: "required" }),
  /** Card slip or wallet transaction number. */
  reference: optionalText(60),
  /** Pay this invoice first; empty = oldest due first. */
  invoiceId: z.union([uuid, z.literal("")]).optional(),
  notes: optionalMultiline(300),
  /** One per opened form: a double submit records the payment once. */
  idempotencyKey: uuid,
})

export const voidPaymentSchema = z.strictObject({
  id: uuid,
  reason: text(3, 300),
})

export const refundSchema = z.strictObject({
  patientId: uuid,
  amount: positiveAmount,
  method: z.enum(PAYMENT_METHODS, { error: "required" }),
  reference: optionalText(60),
  reason: text(3, 300),
})

export const DEBT_FILTERS = ["overdue", "d31_60", "d61_90", "d90plus"] as const

export const debtSearchSchema = z.object({
  q: z.string().max(100).catch(""),
  /** Show patients at least this late (by their oldest unpaid invoice). */
  age: z.enum(DEBT_FILTERS).catch("overdue"),
})

export const paymentReminderSchema = z.strictObject({ patientId: uuid })

export const closeCashSchema = z.strictObject({
  /** Cash counted in the drawer (0 is allowed). */
  counted: amountField(),
  /** Required by the server when the count doesn't match. */
  notes: optionalMultiline(300),
})

export type CloseCashInput = z.input<typeof closeCashSchema>
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>
export type RefundInput = z.input<typeof refundSchema>

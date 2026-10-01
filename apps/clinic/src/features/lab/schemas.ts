import { z } from "zod"

import { optionalAmountField, positiveAmountField } from "@/lib/money"
import {
  isoDate,
  optionalMultiline,
  optionalPhone,
  optionalText,
  text,
  toLatinDigits,
  uuid,
} from "@/lib/validation"

import { LAB_ADJUSTMENT_KINDS, LAB_PAYMENT_METHODS } from "./money"
import { MATERIALS, parseTeeth } from "./rules"

const labFields = {
  name: text(2, 80),
  phone: optionalPhone,
  contactName: optionalText(80),
  turnaroundDays: z
    .string({ error: "required" })
    .transform((v) => toLatinDigits(v).trim())
    .pipe(z.string().regex(/^\d{1,2}$/, "invalidDays"))
    .transform(Number)
    .refine((n) => n >= 1 && n <= 90, "invalidDays"),
  notes: optionalMultiline(300),
}

export const createLabSchema = z.strictObject(labFields)
export const updateLabSchema = z.strictObject({ ...labFields, id: uuid })
export const archiveLabSchema = z.strictObject({ id: uuid })

const teeth = z.string().transform((v, ctx) => {
  const parsed = parseTeeth(v)
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "invalidTeeth" })
    return z.NEVER
  }
  return parsed
})

const caseFields = {
  labId: uuid,
  dentistId: z.union([uuid, z.literal("")]).optional(),
  work: text(2, 80),
  teeth,
  shade: optionalText(20),
  material: z
    .union([z.enum(MATERIALS), z.literal("")])
    .optional()
    .transform((v) => v || null),
  instructions: optionalMultiline(300),
  cost: optionalAmountField(),
  sentOn: isoDate,
  dueOn: isoDate,
}

const datesInOrder = <T extends { sentOn: string; dueOn: string }>(v: T) => v.dueOn >= v.sentOn

export const createLabCaseSchema = z
  .strictObject({
    ...caseFields,
    patientId: uuid,
    planItemId: z.union([uuid, z.literal("")]).optional(),
  })
  .refine(datesInOrder, { path: ["dueOn"], message: "dueBeforeSent" })

export const updateLabCaseSchema = z
  .strictObject({ ...caseFields, id: uuid })
  .refine(datesInOrder, { path: ["dueOn"], message: "dueBeforeSent" })

/**
 * A step in the case's life: back from the lab, fitted, sent back, or cancelled. The
 * first time the work comes back, `cost` (what the lab charges, prefilled from the case)
 * becomes the lab's bill.
 */
export const labCaseStepSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("receive"),
    id: uuid,
    date: isoDate,
    cost: optionalAmountField(),
  }),
  z.strictObject({ action: z.literal("fit"), id: uuid, date: isoDate }),
  z.strictObject({ action: z.literal("remake"), id: uuid, dueOn: isoDate, reason: text(3, 200) }),
  z.strictObject({ action: z.literal("cancel"), id: uuid, reason: text(3, 200) }),
])

export const LAB_FILTERS = ["open", "late", "received", "fitted", "all"] as const

export const labCaseSearchSchema = z.object({
  q: z.string().max(100).catch(""),
  status: z.enum(LAB_FILTERS).catch("open"),
})

/** Money paid to a lab (cash from the drawer, or a transfer). */
export const labPaymentSchema = z.strictObject({
  labId: uuid,
  amount: positiveAmountField(),
  method: z.enum(LAB_PAYMENT_METHODS, { error: "required" }),
  reference: optionalText(60),
  notes: optionalMultiline(300),
  /** One per opened form: a double submit records the payment once. */
  idempotencyKey: uuid,
})

export const voidLabPaymentSchema = z.strictObject({ id: uuid, reason: text(3, 300) })

/** A discount from the lab, or an extra charge not tied to a case. */
export const labAdjustmentSchema = z.strictObject({
  labId: uuid,
  kind: z.enum(LAB_ADJUSTMENT_KINDS, { error: "required" }),
  amount: positiveAmountField(),
  reason: text(3, 200),
})

/** Statement month as "YYYY-MM"; anything else falls back to the current month. */
export const labStatementSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .catch(""),
})

export type LabInput = z.input<typeof createLabSchema>
export type LabCaseInput = z.input<typeof createLabCaseSchema>
export type LabCaseStep = z.input<typeof labCaseStepSchema>
export type LabPaymentInput = z.input<typeof labPaymentSchema>
export type LabAdjustmentInput = z.input<typeof labAdjustmentSchema>

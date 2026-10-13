import { z } from "zod"

import { positiveAmountField } from "@/lib/money"
import { optionalText, text, uuid } from "@/lib/validation"

import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "./expenses"

export const recordExpenseSchema = z.strictObject({
  category: z.enum(EXPENSE_CATEGORIES, { error: "required" }),
  method: z.enum(EXPENSE_METHODS, { error: "required" }),
  amount: positiveAmountField(),
  description: text(2, 200),
  payee: optionalText(100),
  reference: optionalText(60),
  /** One per opened form: a double submit records the expense once. */
  idempotencyKey: uuid,
})

export const voidExpenseSchema = z.strictObject({ id: uuid, reason: text(3, 300) })

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** ?month=YYYY-MM&category=…&q=… (anything else falls back to this month, everything). */
export const expenseParams = z.object({
  month: z.string().regex(MONTH).optional().catch(undefined),
  category: z.enum(EXPENSE_CATEGORIES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
})

export type RecordExpenseInput = z.input<typeof recordExpenseSchema>

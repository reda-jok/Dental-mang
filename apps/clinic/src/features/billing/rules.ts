// Billing rules: pure functions shared by the invoice form (live totals) and the
// server (the numbers that are stored). Amounts are exact decimal strings.

import { addDays } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"

import type { PostingLine } from "../ledger/rules"

export type LineInput = { quantity: number; unitPrice: string; discount: string }

export type LineAmounts = { gross: string; discount: string; total: string }

export type InvoiceTotals = {
  subtotal: string
  discountTotal: string
  extraDiscount: string
  total: string
  lines: LineAmounts[]
}

export type TotalsProblem = "lineDiscountTooLarge" | "extraDiscountTooLarge" | "emptyInvoice"

/** Line and invoice totals, or why the discounts don't fit. */
export function invoiceTotals(
  lines: readonly LineInput[],
  extraDiscount = "0",
): { ok: true; totals: InvoiceTotals } | { ok: false; error: TotalsProblem; line?: number } {
  let subtotal = 0n
  let lineDiscounts = 0n
  const amounts: LineAmounts[] = []
  for (const [index, line] of lines.entries()) {
    const gross = toMinor(line.unitPrice) * BigInt(line.quantity)
    const discount = toMinor(line.discount)
    if (discount > gross) return { ok: false, error: "lineDiscountTooLarge", line: index }
    subtotal += gross
    lineDiscounts += discount
    amounts.push({
      gross: fromMinor(gross),
      discount: fromMinor(discount),
      total: fromMinor(gross - discount),
    })
  }
  if (lines.length === 0 || subtotal === 0n) return { ok: false, error: "emptyInvoice" }
  const extra = toMinor(extraDiscount)
  if (extra > subtotal - lineDiscounts) return { ok: false, error: "extraDiscountTooLarge" }
  const discountTotal = lineDiscounts + extra
  return {
    ok: true,
    totals: {
      subtotal: fromMinor(subtotal),
      discountTotal: fromMinor(discountTotal),
      extraDiscount: fromMinor(extra),
      total: fromMinor(subtotal - discountTotal),
      lines: amounts,
    },
  }
}

/**
 * True when the invoice gives a discount the patient didn't already have: a line
 * discount above what the plan item carried, or any discount on the whole invoice.
 * Giving one needs the `billing:discount` permission.
 */
export function givesNewDiscount(
  lines: readonly { discount: string; agreedDiscount?: string }[],
  extraDiscount: string,
): boolean {
  return (
    toMinor(extraDiscount) > 0n ||
    lines.some((line) => toMinor(line.discount) > toMinor(line.agreedDiscount ?? "0"))
  )
}

/**
 * Journal lines for an issued invoice. Revenue is booked gross and discounts on their
 * own account, so reports can show how much discount was given:
 *   Dr patient receivables (total) + Dr discounts given (discounts) / Cr treatment revenue (subtotal)
 */
export function invoicePosting(
  totals: Pick<InvoiceTotals, "subtotal" | "discountTotal" | "total">,
) {
  const lines: PostingLine[] = []
  if (toMinor(totals.total) > 0n) lines.push({ account: "receivable", debit: totals.total })
  if (toMinor(totals.discountTotal) > 0n)
    lines.push({ account: "discounts", debit: totals.discountTotal })
  lines.push({ account: "revenue", credit: totals.subtotal })
  return lines
}

/** Default due date: `days` after the issue date. */
export function defaultDueDate(issueDate: string, days: number) {
  return addDays(issueDate, days)
}

export type PaymentState = "void" | "paid" | "partial" | "unpaid" | "overdue"

/** An invoice's state from what has been paid (always calculated, never stored). */
export function paymentState(invoice: {
  status: "issued" | "void"
  total: string
  paid: string
  dueDate: string
  today: string
}): PaymentState {
  if (invoice.status === "void") return "void"
  const balance = toMinor(invoice.total) - toMinor(invoice.paid)
  if (balance <= 0n) return "paid"
  if (invoice.dueDate < invoice.today) return "overdue"
  return toMinor(invoice.paid) > 0n ? "partial" : "unpaid"
}

/** "INV-2026-000123" */
export function invoiceNumber(issueDate: string, sequence: bigint | number) {
  return `INV-${issueDate.slice(0, 4)}-${String(sequence).padStart(6, "0")}`
}

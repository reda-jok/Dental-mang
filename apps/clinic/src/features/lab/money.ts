// What the clinic owes its labs: pure functions (unit-tested) used by the lab money
// services, the statement page and its printout. Amounts are exact decimal strings.

import { fromMinor, toMinor } from "@/lib/money"

import type { AccountKey } from "../ledger/accounts"
import type { PostingLine } from "../ledger/rules"

/** Labs are paid in cash from the drawer or by transfer (wallet / bank app). */
export const LAB_PAYMENT_METHODS = ["cash", "wallet"] as const
export type LabPaymentMethod = (typeof LAB_PAYMENT_METHODS)[number]

export const LAB_ADJUSTMENT_KINDS = ["discount", "charge"] as const
export type LabAdjustmentKind = (typeof LAB_ADJUSTMENT_KINDS)[number]

const METHOD_ACCOUNT: Record<LabPaymentMethod, AccountKey> = { cash: "cash", wallet: "wallet" }

/** The work came back: its cost is a lab expense the clinic now owes (Dr lab, Cr payables). */
export function labBillPosting(amount: string, memo?: string): PostingLine[] {
  return [
    { account: "labExpense", debit: amount, memo },
    { account: "payable", credit: amount, memo },
  ]
}

/** Money paid to a lab: Dr payables, Cr cash / wallet. */
export function labPaymentPosting(method: LabPaymentMethod, amount: string): PostingLine[] {
  return [
    { account: "payable", debit: amount },
    { account: METHOD_ACCOUNT[method], credit: amount },
  ]
}

/** A discount lowers the lab expense and what is owed; an extra charge raises both. */
export function labAdjustmentPosting(kind: LabAdjustmentKind, amount: string): PostingLine[] {
  return kind === "discount"
    ? [
        { account: "payable", debit: amount },
        { account: "labExpense", credit: amount },
      ]
    : [
        { account: "labExpense", debit: amount },
        { account: "payable", credit: amount },
      ]
}

/**
 * One line of a lab's account. Bills and extra charges raise what the clinic owes;
 * payments and discounts lower it. A voided payment is listed but doesn't count.
 */
export type LabEntry = {
  kind: "bill" | "charge" | "payment" | "discount"
  date: string
  amount: string
  voided?: boolean
}

/** Signed effect on what the clinic owes (positive = owes more). */
export function owedEffect(entry: LabEntry): bigint {
  if (entry.voided) return 0n
  const amount = toMinor(entry.amount)
  return entry.kind === "bill" || entry.kind === "charge" ? amount : -amount
}

export type LabTotals = { billed: string; charged: string; paid: string; discounted: string }

/** Totals by kind (voided payments left out). */
export function labTotals(entries: readonly LabEntry[]): LabTotals {
  const sums = { bill: 0n, charge: 0n, payment: 0n, discount: 0n }
  for (const entry of entries) if (!entry.voided) sums[entry.kind] += toMinor(entry.amount)
  return {
    billed: fromMinor(sums.bill),
    charged: fromMinor(sums.charge),
    paid: fromMinor(sums.payment),
    discounted: fromMinor(sums.discount),
  }
}

/** What the clinic owes from these totals (negative = the lab holds the clinic's credit). */
export function owedFrom(totals: LabTotals): string {
  return fromMinor(
    toMinor(totals.billed) +
      toMinor(totals.charged) -
      toMinor(totals.paid) -
      toMinor(totals.discounted),
  )
}

/**
 * A month of a lab's account: the balance brought forward, each entry with the balance
 * after it (in date order; the caller sorts entries of the same day), and the totals.
 */
export function labStatement<T extends LabEntry>(opening: string, entries: readonly T[]) {
  let balance = toMinor(opening)
  const rows = entries.map((entry) => {
    balance += owedEffect(entry)
    return { ...entry, balance: fromMinor(balance) }
  })
  return { opening, rows, totals: labTotals(entries), closing: fromMinor(balance) }
}

/** "2026-09" → first day, first day of the next month, and the neighbouring months. */
export function monthRange(month: string) {
  const [year, m] = month.split("-").map(Number) as [number, number]
  const iso = (y: number, mm: number) => `${y}-${String(mm).padStart(2, "0")}`
  const prev = m === 1 ? iso(year - 1, 12) : iso(year, m - 1)
  const next = m === 12 ? iso(year + 1, 1) : iso(year, m + 1)
  return { start: `${month}-01`, end: `${next}-01`, prev, next }
}

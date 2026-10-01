// Daily cash close: what should be in the drawer, and how a difference is booked.
// Pure functions (unit-tested), used by the close form (live) and the service.

import { fromMinor, toMinor } from "@/lib/money"

import type { PostingLine } from "../ledger/rules"
import type { PaymentMethod } from "./payments"

export type MovementKind =
  "payment" | "payment_void" | "refund" | "lab_payment" | "lab_payment_void"

/** A money movement not closed yet. `amount` is the positive size of the movement. */
export type Movement = { kind: MovementKind; method: PaymentMethod; amount: string }

/**
 * Whether a movement brings money in: a patient's payment, or a lab payment voided
 * (the money is back). Refunds, voided patient payments and lab payments take it out.
 */
export function isMoneyIn(kind: MovementKind): boolean {
  return kind === "payment" || kind === "lab_payment_void"
}

/** As stored on a close item: money in is positive, money out negative. */
export function signedAmount(m: Movement): string {
  return isMoneyIn(m.kind) ? m.amount : `-${m.amount}`
}

export type CashSummary = {
  /** Cash received. */
  cashIn: string
  /** Cash given back, taken back or paid out: refunds, voided payments, lab payments. */
  cashOut: string
  /** What the drawer should hold from these movements: cashIn − cashOut. */
  expected: string
  /** Card and wallet money received from patients, to check against the machine and statements. */
  card: string
  wallet: string
  counts: { cashIn: number; cashOut: number; card: number; wallet: number }
}

export function summarize(movements: readonly Movement[]): CashSummary {
  let cashIn = 0n
  let cashOut = 0n
  let card = 0n
  let wallet = 0n
  const counts = { cashIn: 0, cashOut: 0, card: 0, wallet: 0 }
  for (const m of movements) {
    const amount = toMinor(m.amount)
    if (m.method === "cash") {
      if (isMoneyIn(m.kind)) {
        cashIn += amount
        counts.cashIn++
      } else {
        cashOut += amount
        counts.cashOut++
      }
    } else if (m.kind === "payment") {
      if (m.method === "card") {
        card += amount
        counts.card++
      } else {
        wallet += amount
        counts.wallet++
      }
    }
  }
  return {
    cashIn: fromMinor(cashIn),
    cashOut: fromMinor(cashOut),
    expected: fromMinor(cashIn - cashOut),
    card: fromMinor(card),
    wallet: fromMinor(wallet),
    counts,
  }
}

export type CloseOutcome = { difference: string; kind: "match" | "over" | "short" }

/** Counted vs expected: over (more cash than recorded) or short (missing cash). */
export function closeOutcome(counted: string, expected: string): CloseOutcome {
  const difference = toMinor(counted) - toMinor(expected)
  return {
    difference: fromMinor(difference),
    kind: difference === 0n ? "match" : difference > 0n ? "over" : "short",
  }
}

/**
 * The journal entry for a difference, so the books show the cash actually counted:
 * short = Dr cash over/short, Cr cash; over = Dr cash, Cr cash over/short.
 */
export function differencePosting(difference: string): PostingLine[] | null {
  const minor = toMinor(difference.replace("-", ""))
  if (minor === 0n) return null
  const amount = fromMinor(minor)
  return difference.startsWith("-")
    ? [
        { account: "cashOverShort", debit: amount },
        { account: "cash", credit: amount },
      ]
    : [
        { account: "cash", debit: amount },
        { account: "cashOverShort", credit: amount },
      ]
}

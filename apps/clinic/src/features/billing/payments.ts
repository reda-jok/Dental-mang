// Payment rules: pure functions (unit-tested) used by the payment services.
// Amounts are exact decimal strings; arithmetic is in minor units.

import { fromMinor, toMinor } from "@/lib/money"

import type { AccountKey } from "../ledger/accounts"
import type { PostingLine } from "../ledger/rules"

export const PAYMENT_METHODS = ["cash", "card", "wallet"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const METHOD_ACCOUNT: Record<PaymentMethod, AccountKey> = {
  cash: "cash",
  card: "card",
  wallet: "wallet",
}

/** Money received: Dr cash / card / wallet, Cr patient receivables. */
export function paymentPosting(method: PaymentMethod, amount: string): PostingLine[] {
  return [
    { account: METHOD_ACCOUNT[method], debit: amount },
    { account: "receivable", credit: amount },
  ]
}

/** Money given back: Dr patient receivables, Cr cash / card / wallet. */
export function refundPosting(method: PaymentMethod, amount: string): PostingLine[] {
  return [
    { account: "receivable", debit: amount },
    { account: METHOD_ACCOUNT[method], credit: amount },
  ]
}

export type Allocation = { paymentId: string; invoiceId: string; amount: string }

/**
 * Money not yet applied to an invoice, per payment (oldest first). Refunds are paid
 * out of the newest money, so older payments stay available for invoices.
 */
export function unappliedMoney(
  payments: readonly { id: string; amount: string; applied: string }[],
  refunded: string,
): { paymentId: string; amount: bigint }[] {
  const left = payments.map((p) => ({
    paymentId: p.id,
    amount: toMinor(p.amount) - toMinor(p.applied),
  }))
  let refund = toMinor(refunded)
  for (let i = left.length - 1; i >= 0 && refund > 0n; i--) {
    const take = left[i]!.amount < refund ? left[i]!.amount : refund
    left[i]!.amount -= take
    refund -= take
  }
  return left.filter((p) => p.amount > 0n)
}

/**
 * Applies unapplied money to open invoices: the preferred invoice first, then in the
 * given order (oldest due first). Oldest money is used first.
 */
export function allocate(
  money: readonly { paymentId: string; amount: bigint }[],
  invoices: readonly { id: string; balance: string }[],
  preferredInvoiceId?: string | null,
): Allocation[] {
  const queue = [
    ...invoices.filter((i) => i.id === preferredInvoiceId),
    ...invoices.filter((i) => i.id !== preferredInvoiceId),
  ].map((i) => ({ id: i.id, due: toMinor(i.balance) }))
  const pool = money.map((m) => ({ ...m }))
  const result: Allocation[] = []
  for (const invoice of queue) {
    for (const source of pool) {
      if (invoice.due <= 0n) break
      if (source.amount <= 0n) continue
      const take = source.amount < invoice.due ? source.amount : invoice.due
      source.amount -= take
      invoice.due -= take
      result.push({ paymentId: source.paymentId, invoiceId: invoice.id, amount: fromMinor(take) })
    }
  }
  return result
}

/**
 * A patient's account. `balance` > 0: the patient owes; < 0: the clinic holds credit.
 * (Equals the patient's receivables in the ledger: invoices − payments + refunds.)
 */
export function patientAccount(totals: { invoiced: string; received: string; refunded: string }) {
  const paid = toMinor(totals.received) - toMinor(totals.refunded)
  const balance = toMinor(totals.invoiced) - paid
  return {
    invoiced: totals.invoiced,
    paid: fromMinor(paid),
    balance: fromMinor(balance),
    owes: balance > 0n,
    credit: balance < 0n ? fromMinor(-balance) : "0",
  }
}

export function sumAmounts(amounts: readonly { toString(): string }[]) {
  return fromMinor(amounts.reduce<bigint>((total, a) => total + toMinor(a.toString()), 0n))
}

/** "RC-2026-000123" / "RF-2026-000123" */
export function documentNumber(prefix: "RC" | "RF", day: string, sequence: bigint | number) {
  return `${prefix}-${day.slice(0, 4)}-${String(sequence).padStart(6, "0")}`
}

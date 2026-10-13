// Expenses: which accounts they can be booked to, where they're paid from, and how they
// post to the ledger. Pure, unit-tested.

import { fromMinor, toMinor } from "@/lib/money"

import type { AccountKey } from "../ledger/accounts"
import type { PostingLine } from "../ledger/rules"

/** The expense accounts staff choose from, as categories. Lab, commission and cash
 * over/short are posted by the app itself, so they're not offered. */
export const EXPENSE_CATEGORIES = [
  "supplies",
  "rent",
  "utilities",
  "salaries",
  "maintenance",
  "telecom",
  "marketing",
  "otherExpense",
] as const satisfies readonly AccountKey[]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_METHODS = ["cash", "wallet", "bank"] as const
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number]

const METHOD_ACCOUNT: Record<ExpenseMethod, AccountKey> = {
  cash: "cash",
  wallet: "wallet",
  bank: "bank",
}

/** Dr the expense account, Cr where the money came from. */
export function expensePosting(
  category: ExpenseCategory,
  method: ExpenseMethod,
  amount: string,
  memo?: string,
): PostingLine[] {
  return [
    { account: category, debit: amount, memo },
    { account: METHOD_ACCOUNT[method], credit: amount, memo },
  ]
}

/** A month's expenses that still count (voided ones don't): the total, by category, from the drawer. */
export function expenseTotals(
  rows: readonly { category: string; method: ExpenseMethod; amount: string; voided: boolean }[],
) {
  let total = 0n
  let cash = 0n
  const byCategory = new Map<string, bigint>()
  for (const r of rows) {
    if (r.voided) continue
    const amount = toMinor(r.amount)
    total += amount
    if (r.method === "cash") cash += amount
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0n) + amount)
  }
  return {
    total: fromMinor(total),
    cash: fromMinor(cash),
    byCategory: [...byCategory]
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .map(([category, amount]) => ({ category, amount: fromMinor(amount) })),
  }
}

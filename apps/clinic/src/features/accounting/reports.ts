// Accounting reports: pure functions (unit-tested) over sums the database makes from the
// ledger. Amounts are exact decimal strings; debits and credits come as separate
// non-negative sums, and arithmetic is in minor units.

import { fromMinor, toMinor } from "@/lib/money"

import { ACCOUNTS } from "../ledger/accounts"

/** A month's debits and credits on one revenue or expense account. */
export type LedgerMonthRow = {
  month: string
  code: string
  name: string
  type: "revenue" | "expense"
  debit: string
  credit: string
}

/** Money in and out of an account in a month (for the money collected). */
export type MoneyMonthRow = { month: string; debit: string; credit: string }

const desc = (a: bigint, b: bigint) => (b > a ? 1 : b < a ? -1 : 0)

/**
 * The profit and loss for a run of months (oldest first): treatments billed, discounts,
 * costs by account, profit, and the money collected beside it. Dentist pay is the
 * calculated figure, so what's recorded as handed to dentists (account 5200) is left out:
 * counting both would count their pay twice.
 */
export function profitAndLoss(
  months: readonly string[],
  rows: readonly LedgerMonthRow[],
  dentistPay: ReadonlyMap<string, string>,
  collected: readonly MoneyMonthRow[],
) {
  const at = new Map(months.map((m, i) => [m, i]))
  const zeros = () => months.map(() => 0n)
  const revenue = zeros()
  const discounts = zeros()
  const money = zeros()
  const costs = new Map<string, { name: string; amounts: bigint[] }>()
  for (const r of rows) {
    const i = at.get(r.month)
    if (i === undefined) continue
    const net = toMinor(r.debit) - toMinor(r.credit)
    if (r.code === ACCOUNTS.discounts) discounts[i]! += net
    else if (r.type === "revenue") revenue[i]! -= net
    else if (r.code !== ACCOUNTS.dentistPay) {
      const cost = costs.get(r.code) ?? { name: r.name, amounts: zeros() }
      cost.amounts[i]! += net
      costs.set(r.code, cost)
    }
  }
  for (const r of collected) {
    const i = at.get(r.month)
    if (i !== undefined) money[i]! += toMinor(r.debit) - toMinor(r.credit)
  }

  const last = months.length - 1
  const lines = [
    {
      key: "dentistPay",
      name: null as string | null,
      amounts: months.map((m) => toMinor(dentistPay.get(m) ?? "0")),
    },
    ...[...costs].map(([code, c]) => ({
      key: code,
      name: c.name as string | null,
      amounts: c.amounts,
    })),
  ]
    .filter((l) => l.amounts.some((a) => a !== 0n))
    .sort((a, b) => desc(a.amounts[last]!, b.amounts[last]!))
  const totalCosts = months.map((_, i) => lines.reduce((sum, l) => sum + l.amounts[i]!, 0n))
  const netRevenue = months.map((_, i) => revenue[i]! - discounts[i]!)
  const strings = (xs: bigint[]) => xs.map(fromMinor)
  return {
    months: [...months],
    revenue: strings(revenue),
    discounts: strings(discounts),
    netRevenue: strings(netRevenue),
    costs: lines.map((l) => ({ key: l.key, name: l.name, amounts: strings(l.amounts) })),
    totalCosts: strings(totalCosts),
    profit: strings(months.map((_, i) => netRevenue[i]! - totalCosts[i]!)),
    collected: strings(money),
  }
}

export type ProfitAndLoss = ReturnType<typeof profitAndLoss>

/** A month of one money account: the balance brought forward, each movement with the balance after it, the totals. */
export function cashBook<T extends { debit: string; credit: string }>(
  opening: { debit: string; credit: string },
  entries: readonly T[],
) {
  const start = toMinor(opening.debit) - toMinor(opening.credit)
  let balance = start
  let moneyIn = 0n
  let moneyOut = 0n
  const rows = entries.map((entry) => {
    const debit = toMinor(entry.debit)
    const credit = toMinor(entry.credit)
    moneyIn += debit
    moneyOut += credit
    balance += debit - credit
    return { ...entry, balance: fromMinor(balance) }
  })
  return {
    opening: fromMinor(start),
    rows,
    moneyIn: fromMinor(moneyIn),
    moneyOut: fromMinor(moneyOut),
    closing: fromMinor(balance),
  }
}

/**
 * Rows above zero, biggest first, with their percent of the total (shown as text) and
 * their size against the biggest (the bar's width, 0–1).
 */
export function withShares<T extends { amount: string }>(rows: readonly T[]) {
  const kept = rows
    .map((row) => ({ row, minor: toMinor(row.amount) }))
    .filter((r) => r.minor > 0n)
    .sort((a, b) => desc(a.minor, b.minor))
  const total = kept.reduce((sum, r) => sum + r.minor, 0n)
  const max = kept[0]?.minor ?? 0n
  return kept.map(({ row, minor }) => ({
    ...row,
    // Display only: a percent with one decimal and a bar width.
    percent: Number((minor * 1000n) / total) / 10,
    bar: Number((minor * 1000n) / max) / 1000,
  }))
}

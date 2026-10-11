// Dentist commission, calculated from payment allocations (never stored). Pure.
//
// Each invoice line done by a dentist earns from the money applied to its invoice, in
// proportion to the line's share of the invoice. Its commission base at any moment is
// the money collected for it so far, less the same share of its lab cost when the lab
// cost is deducted. A month's figure is the base at the month's end minus the base at its
// start, so a payment voided in November lowers November (a paid October never changes),
// and a lab bill that arrives after the payment is caught up in the month it arrives.

import { fromMinor, toMinor } from "@/lib/money"

export type CommissionLine = {
  lineId: string
  /** This line's total, the sum of all line totals on its invoice, and the invoice total. */
  lineTotal: string
  linesTotal: string
  invoiceTotal: string
  /** Money applied to the invoice: when, and when it stopped counting (a void). */
  allocations: readonly { amount: string; at: Date; until: Date | null }[]
  /** The lab's bills for this line's treatment, and when each was billed. */
  labBills: readonly { cost: string; at: Date }[]
}

/** a × b ÷ c, rounded half up (non-negative c). */
function mulDiv(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) return 0n
  const n = a * b
  const q = n / c
  const r = n % c
  return r * 2n >= c ? q + 1n : r * 2n <= -c ? q - 1n : q
}

/** To whole dinars (IQD has no smaller unit in use), so every figure adds up by hand. */
const toDinars = (minor: bigint) => mulDiv(minor, 1n, 100n) * 100n

function share(line: CommissionLine, amount: bigint): bigint {
  return toDinars(mulDiv(amount, toMinor(line.lineTotal), toMinor(line.linesTotal)))
}

/** The line's share of money applied before `t` and still counting at `t`. */
function collectedBy(line: CommissionLine, t: Date): bigint {
  let sum = 0n
  for (const a of line.allocations) {
    if (a.at < t && !(a.until && a.until <= t)) sum += toMinor(a.amount)
  }
  return share(line, sum)
}

function baseBy(line: CommissionLine, t: Date, deductLab: boolean): bigint {
  const collected = collectedBy(line, t)
  if (!deductLab || collected <= 0n) return collected
  const lab = line.labBills.filter((b) => b.at < t).reduce((s, b) => s + toMinor(b.cost), 0n)
  const collectible = share(line, toMinor(line.invoiceTotal))
  if (collectible <= 0n) return 0n
  const base = collected - toDinars(mulDiv(lab, collected, collectible))
  return base > 0n ? base : 0n
}

/** What one line earned between `start` and `end`. Amounts in minor units. */
export function lineForPeriod(line: CommissionLine, start: Date, end: Date, deductLab: boolean) {
  const collected = collectedBy(line, end) - collectedBy(line, start)
  const base = baseBy(line, end, deductLab) - baseBy(line, start, deductLab)
  return { collected, lab: collected - base, base }
}

/** Base × rate%, in whole dinars (half up). `rate` is a decimal string like "12.5". */
export function commissionOf(base: bigint, rate: string): bigint {
  const [whole, fraction = ""] = rate.split(".")
  const basisPoints = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2))
  return toDinars(mulDiv(base, basisPoints, 10_000n))
}

export type PayVersion = {
  payType: "salary" | "commission" | "both"
  commissionRate: string
  monthlySalary: string | null
  deductLab: boolean
  /** "YYYY-MM" */
  effectiveFrom: string
  createdAt: Date
}

/** The pay in force for a month: the latest version starting on or before it. */
export function payFor<T extends PayVersion>(versions: readonly T[], month: string): T | null {
  return (
    versions
      .filter((v) => v.effectiveFrom <= month)
      .sort(
        (a, b) =>
          b.effectiveFrom.localeCompare(a.effectiveFrom) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
  )
}

/**
 * A dentist's month: money collected for their work, the lab cost taken off, the base,
 * the commission and the salary, as decimal strings.
 */
export function dentistMonth(
  lines: readonly CommissionLine[],
  pay: PayVersion | null,
  start: Date,
  end: Date,
) {
  const deductLab = pay?.deductLab ?? true
  let collected = 0n
  let lab = 0n
  let base = 0n
  const changed: { lineId: string; collected: string; lab: string; base: string }[] = []
  for (const line of lines) {
    const l = lineForPeriod(line, start, end, deductLab)
    if (l.collected === 0n && l.base === 0n) continue
    collected += l.collected
    lab += l.lab
    base += l.base
    changed.push({
      lineId: line.lineId,
      collected: fromMinor(l.collected),
      lab: fromMinor(l.lab),
      base: fromMinor(l.base),
    })
  }
  const earnsCommission = pay?.payType === "commission" || pay?.payType === "both"
  const commission = earnsCommission ? commissionOf(base, pay!.commissionRate) : 0n
  const salary = pay && pay.payType !== "commission" ? toMinor(pay.monthlySalary ?? "0") : 0n
  return {
    collected: fromMinor(collected),
    lab: fromMinor(lab),
    base: fromMinor(base),
    commission: fromMinor(commission),
    salary: fromMinor(salary),
    total: fromMinor(salary + commission),
    lines: changed,
  }
}

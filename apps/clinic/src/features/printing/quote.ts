// The printed treatment plan: payment schedule, chair time per phase, what fits on one
// page, and the options chosen before printing. Pure, unit-tested.

import { z } from "zod"

import { fromMinor, toMinor } from "@/lib/money"

import { dentitionForAge, isPrimary, type Dentition } from "../chart/teeth"

export const PAYMENT_MODES = ["full", "phase", "months"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]
export const INSTALLMENT_MONTHS = [3, 6, 10, 12] as const
export const DEPOSIT_PERCENTS = [0, 20, 30, 50] as const
export const COPIES = ["both", "patient", "clinic"] as const

/** Options picked on screen before printing (URL search params; nothing is saved). */
export const quoteOptionsSchema = z.object({
  copies: z.enum(COPIES).catch("both"),
  pay: z.enum(PAYMENT_MODES).optional().catch(undefined),
  months: z.coerce
    .number()
    .pipe(z.union(INSTALLMENT_MONTHS.map((m) => z.literal(m))))
    .catch(6),
  deposit: z.coerce
    .number()
    .pipe(z.union(DEPOSIT_PERCENTS.map((d) => z.literal(d))))
    .catch(0),
})
export type QuoteOptions = z.output<typeof quoteOptionsSchema>

export type ScheduleLine =
  | { kind: "now"; amount: string }
  | { kind: "deposit"; amount: string }
  | { kind: "phase"; phase: number; amount: string }
  | { kind: "month"; month: number; amount: string }

const THOUSAND = 100_000n // 1,000 dinars in minor units: how people pay in cash
const DINAR = 100n

/** Rounds down to whole thousands when the amount allows, else to whole dinars. */
const roundDown = (minor: bigint, parts: bigint) => {
  const unit = minor >= parts * THOUSAND ? THOUSAND : DINAR
  return (minor / parts / unit) * unit
}

/**
 * How the rest of the plan can be paid. What's already paid covers the earliest phases
 * first. Installments are whole thousands of dinars and the last one takes the remainder,
 * so the lines always add up exactly to what's left.
 */
export function paymentSchedule(input: {
  phases: { phase: number; net: string }[]
  paid: string
  mode: PaymentMode
  months: number
  depositPercent: number
}): { remaining: string; lines: ScheduleLine[] } {
  const total = input.phases.reduce((sum, p) => sum + toMinor(p.net), 0n)
  let credit = toMinor(input.paid)
  const remaining = total > credit ? total - credit : 0n
  if (remaining === 0n) return { remaining: "0", lines: [] }

  if (input.mode === "phase") {
    const lines: ScheduleLine[] = []
    for (const { phase, net } of input.phases) {
      const covered = credit < toMinor(net) ? credit : toMinor(net)
      credit -= covered
      const left = toMinor(net) - covered
      if (left > 0n) lines.push({ kind: "phase", phase, amount: fromMinor(left) })
    }
    return { remaining: fromMinor(remaining), lines }
  }

  if (input.mode === "months") {
    const deposit = roundDown((remaining * BigInt(input.depositPercent)) / 100n, 1n)
    const rest = remaining - deposit
    const months = BigInt(input.months)
    const each = roundDown(rest, months)
    const lines: ScheduleLine[] =
      deposit > 0n ? [{ kind: "deposit", amount: fromMinor(deposit) }] : []
    for (let m = 1n; m <= months; m++) {
      const amount = m === months ? rest - each * (months - 1n) : each
      lines.push({ kind: "month", month: Number(m), amount: fromMinor(amount) })
    }
    return { remaining: fromMinor(remaining), lines }
  }

  return { remaining: fromMinor(remaining), lines: [{ kind: "now", amount: fromMinor(remaining) }] }
}

/**
 * Chair time per phase from the catalog durations, rounded up to a quarter hour.
 * Procedures without a duration add nothing; 0 = unknown.
 */
export function chairTime(items: { phase: number; durationMinutes: number | null }[]) {
  const minutes = new Map<number, number>()
  for (const item of items) {
    minutes.set(item.phase, (minutes.get(item.phase) ?? 0) + (item.durationMinutes ?? 0))
  }
  for (const [phase, total] of minutes) minutes.set(phase, Math.ceil(total / 15) * 15)
  return minutes
}

/** The patient's dentition by age, widened to mixed when the plan has teeth outside it. */
export function chartDentition(age: number | null, teeth: readonly number[]): Dentition {
  const byAge = dentitionForAge(age)
  if (byAge === "permanent" && teeth.some(isPrimary)) return "mixed"
  if (byAge === "primary" && teeth.some((t) => !isPrimary(t))) return "mixed"
  return byAge
}

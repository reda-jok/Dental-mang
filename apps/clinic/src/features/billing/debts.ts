// Overdue debts: how long invoices have been unpaid past their due date (aging),
// summed per patient. Pure functions, shared by the debts page and its tests.

import { fromMinor, toMinor } from "@/lib/money"

/** Age groups by days past the due date. "current" = not due yet. */
export const AGE_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90plus"] as const
export type AgeBucket = (typeof AGE_BUCKETS)[number]
export const OVERDUE_BUCKETS = ["d1_30", "d31_60", "d61_90", "d90plus"] as const

/** Whole days from `from` to `to` (ISO dates). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function ageBucket(dueDate: string, today: string): AgeBucket {
  const late = daysBetween(dueDate, today)
  if (late <= 0) return "current"
  if (late <= 30) return "d1_30"
  if (late <= 60) return "d31_60"
  if (late <= 90) return "d61_90"
  return "d90plus"
}

export type OpenInvoice = { patientId: string; dueDate: string; balance: string }

export type PatientDebt = {
  patientId: string
  /** Everything still owed, due or not. */
  owed: string
  /** The part that is past due. */
  overdue: string
  buckets: Record<AgeBucket, string>
  /** Oldest due date among unpaid invoices that are past due, and how late it is. */
  oldestDue: string | null
  daysLate: number
  /** The worst age group, for sorting and colouring. */
  worst: AgeBucket
}

/** Sums each patient's open invoices into age groups. */
export function agePatientDebts(invoices: readonly OpenInvoice[], today: string): PatientDebt[] {
  const byPatient = new Map<string, { buckets: Record<AgeBucket, bigint>; oldest: string | null }>()
  for (const invoice of invoices) {
    const entry = byPatient.get(invoice.patientId) ?? {
      buckets: { current: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, d90plus: 0n },
      oldest: null,
    }
    const bucket = ageBucket(invoice.dueDate, today)
    entry.buckets[bucket] += toMinor(invoice.balance)
    if (bucket !== "current" && (!entry.oldest || invoice.dueDate < entry.oldest)) {
      entry.oldest = invoice.dueDate
    }
    byPatient.set(invoice.patientId, entry)
  }
  return [...byPatient.entries()].map(([patientId, { buckets, oldest }]) => {
    const overdue = OVERDUE_BUCKETS.reduce((sum, b) => sum + buckets[b], 0n)
    return {
      patientId,
      owed: fromMinor(overdue + buckets.current),
      overdue: fromMinor(overdue),
      buckets: Object.fromEntries(AGE_BUCKETS.map((b) => [b, fromMinor(buckets[b])])) as Record<
        AgeBucket,
        string
      >,
      oldestDue: oldest,
      daysLate: oldest ? daysBetween(oldest, today) : 0,
      worst: oldest ? ageBucket(oldest, today) : "current",
    }
  })
}

/** Totals per age group across all patients (for the summary cards). */
export function bucketTotals(debts: readonly PatientDebt[]) {
  return Object.fromEntries(
    AGE_BUCKETS.map((b) => [
      b,
      {
        amount: fromMinor(debts.reduce((sum, d) => sum + toMinor(d.buckets[b]), 0n)),
        patients: debts.filter((d) => toMinor(d.buckets[b]) > 0n).length,
      },
    ]),
  ) as Record<AgeBucket, { amount: string; patients: number }>
}

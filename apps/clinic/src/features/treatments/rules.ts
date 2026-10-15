// The clinic's treatment lists: pure rules (unit-tested) over plan items.
// Amounts are exact decimal strings; arithmetic is in minor units.

import { fromMinor, toMinor } from "@/lib/money"

/** Treatments still to do: planned, or started and not finished. */
export const OPEN_ITEM_STATUSES = ["planned", "in_progress"] as const

export type ListItem = {
  status: "planned" | "in_progress" | "done" | "cancelled"
  phase: number
  price: string
  discount: string
  tooth: number | null
  procedureName: string
  dentistName: string | null
}

const isOpen = (i: ListItem) => i.status === "planned" || i.status === "in_progress"
const net = (i: { price: string; discount: string }) => toMinor(i.price) - toMinor(i.discount)

/**
 * A plan's progress: treatments done of those not cancelled, the value still to do, its
 * dentists, and what comes next (the open treatments of the earliest open phase).
 */
export function planProgress(items: readonly ListItem[]) {
  const active = items.filter((i) => i.status !== "cancelled")
  const open = active.filter(isOpen)
  const nextPhase = open.length > 0 ? Math.min(...open.map((i) => i.phase)) : null
  return {
    done: active.length - open.length,
    total: active.length,
    left: fromMinor(open.reduce((sum, i) => sum + net(i), 0n)),
    dentists: [...new Set(active.flatMap((i) => (i.dentistName ? [i.dentistName] : [])))],
    next: open
      .filter((i) => i.phase === nextPhase)
      .map((i) => ({ procedureName: i.procedureName, tooth: i.tooth })),
  }
}

/** Count and value per key (a dentist, a kind of treatment), biggest value first. */
export function tally<T extends { price: string; discount: string }>(
  rows: readonly T[],
  keyOf: (row: T) => { key: string; label: string | null },
) {
  const totals = new Map<
    string,
    { key: string; label: string | null; count: number; minor: bigint }
  >()
  for (const row of rows) {
    const { key, label } = keyOf(row)
    const t = totals.get(key) ?? { key, label, count: 0, minor: 0n }
    t.count++
    t.minor += net(row)
    totals.set(key, t)
  }
  return [...totals.values()]
    .sort((a, b) => (b.minor > a.minor ? 1 : b.minor < a.minor ? -1 : b.count - a.count))
    .map(({ minor, ...t }) => ({ ...t, amount: fromMinor(minor) }))
}

/** Whole days from one clinic date to another (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

// Clinic statistics for the dashboard: attendance, top procedures, busiest hours. Pure.

import { fromMinor, toMinor } from "@/lib/money"

type Status = "pending" | "in_progress" | "completed" | "cancelled" | "no_show"

/**
 * No-show rate: missed visits among those that should have happened (finished or missed).
 * Cancellation rate: cancelled among everything booked. Null when there is nothing to
 * divide by.
 */
export function attendanceRates(counts: Partial<Record<Status, number>>) {
  const completed = counts.completed ?? 0
  const noShows = counts.no_show ?? 0
  const cancelled = counts.cancelled ?? 0
  const booked = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)
  return {
    noShowRate: completed + noShows > 0 ? noShows / (completed + noShows) : null,
    cancelRate: booked > 0 ? cancelled / booked : null,
    noShows,
    cancelled,
    booked,
  }
}

/** "2026-01" → "2025-12". */
export function previousMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split("-").map(Number) as [number, number]
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`
}

/** The procedures done most often, then by value; `share` is relative to the top one. */
export function topProcedures(
  items: readonly { procedureId: string; name: string; net: string }[],
  limit = 5,
) {
  const byProcedure = new Map<string, { name: string; count: number; value: bigint }>()
  for (const item of items) {
    const entry = byProcedure.get(item.procedureId) ?? { name: item.name, count: 0, value: 0n }
    entry.count++
    entry.value += toMinor(item.net)
    byProcedure.set(item.procedureId, entry)
  }
  const sorted = [...byProcedure.entries()]
    .map(([procedureId, e]) => ({ procedureId, ...e }))
    .sort((a, b) => b.count - a.count || (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
    .slice(0, limit)
  const top = sorted[0]?.count ?? 1
  return sorted.map((e) => ({ ...e, value: fromMinor(e.value), share: e.count / top }))
}

/** Appointments per weekday (rows, in the given order) and hour (columns). */
export function busyGrid(
  slots: readonly { weekday: number; hour: number }[],
  weekdays: readonly number[],
  hours: readonly number[],
) {
  const counts = new Map<string, number>()
  for (const s of slots)
    counts.set(`${s.weekday}:${s.hour}`, (counts.get(`${s.weekday}:${s.hour}`) ?? 0) + 1)
  const rows = weekdays.map((weekday) => ({
    weekday,
    cells: hours.map((hour) => counts.get(`${weekday}:${hour}`) ?? 0),
  }))
  return { rows, hours: [...hours], max: Math.max(0, ...rows.flatMap((r) => r.cells)) }
}

/** Shade 0 (none) to 5 (busiest) for a heat cell. */
export function heatStep(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  return Math.max(1, Math.ceil((count / max) * 5))
}

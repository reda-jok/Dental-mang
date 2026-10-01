// Scheduling rules. Pure (no DB, no clock) so each one is unit-tested.

import { addDays, weekdayOf } from "@/lib/dates"

export type AppointmentStatus = "pending" | "in_progress" | "completed" | "cancelled" | "no_show"

/** Statuses that occupy the dentist's and the room's time. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["pending", "in_progress", "completed"]

/** 990 → "16:30" */
export function minutesToHhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** "16:30" → 990, or null when not a valid time. */
export function hhmmToMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Bookable start times between opening and closing (the last slot ends at closing). */
export function generateSlots(dayStart: number, dayEnd: number, slot: number): number[] {
  const slots: number[] = []
  for (let t = dayStart; t + slot <= dayEnd; t += slot) slots.push(t)
  return slots
}

export type Busy = { start: number; end: number } // minutes after midnight, end exclusive

export function overlaps(a: Busy, b: Busy): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Each slot with whether an appointment of `duration` minutes starting there would
 * clash with busy time, or run past closing.
 */
export function slotAvailability(slots: number[], duration: number, busy: Busy[], dayEnd: number) {
  return slots.map((start) => {
    const wanted = { start, end: start + duration }
    return {
      start,
      taken: wanted.end > dayEnd || busy.some((b) => overlaps(wanted, b)),
    }
  })
}

/** Closed on this date: a weekly day off, or a one-off rest day. */
export function isRestDay(
  isoDate: string,
  holidays: ReadonlySet<string>,
  weeklyOffDays: readonly number[],
) {
  return holidays.has(isoDate) || weeklyOffDays.includes(weekdayOf(isoDate))
}

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "pending", "cancelled"],
  completed: [], // final: a new visit is a new appointment
  cancelled: [],
  no_show: [], // "reschedule" books a new appointment
}

export function canChangeStatus(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Iraqi calendars start the week on Saturday. */
export const WEEK_START = 6

/** The 7 dates of the week (Saturday → Friday) containing `isoDate`. */
export function weekOf(isoDate: string): string[] {
  const offset = (weekdayOf(isoDate) - WEEK_START + 7) % 7
  const start = addDays(isoDate, -offset)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 6 weeks × 7 days covering the month of `isoDate` (like a wall calendar). */
export function monthGrid(isoDate: string): string[] {
  const first = `${isoDate.slice(0, 7)}-01`
  const start = weekOf(first)[0]!
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

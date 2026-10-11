// The daily reminder list: whose appointment still needs a WhatsApp reminder. Pure.

import { addDays } from "@/lib/dates"

import { isRestDay } from "../appointments/rules"

export type ReminderState = "sent" | "todo" | "noPhone"

/** Sent once there is any reminder for this appointment (a new booking needs its own). */
export function reminderState(row: { phone: string | null; sentCount: number }): ReminderState {
  if (row.sentCount > 0) return "sent"
  return row.phone ? "todo" : "noPhone"
}

export function summarize(rows: readonly { state: ReminderState }[]) {
  return {
    total: rows.length,
    sent: rows.filter((r) => r.state === "sent").length,
    todo: rows.filter((r) => r.state === "todo").length,
    noPhone: rows.filter((r) => r.state === "noPhone").length,
  }
}

/** The day reminders are sent for: the next day the clinic is open (after a Friday, Saturday). */
export function nextOpenDay(
  today: string,
  holidays: ReadonlySet<string>,
  weeklyOffDays: readonly number[],
): string {
  for (let day = addDays(today, 1), n = 0; n < 31; day = addDays(day, 1), n++) {
    if (!isRestDay(day, holidays, weeklyOffDays)) return day
  }
  return addDays(today, 1)
}

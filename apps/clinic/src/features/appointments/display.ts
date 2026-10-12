// Display helpers shared by the calendar, scheduler and booking form.

import type { AppointmentStatus } from "./rules"

/** Status colours from the clinic's original calendar and scheduler. */
export const STATUS_CHIP: Record<AppointmentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700 line-through",
  no_show: "bg-slate-200 text-slate-600 line-through",
}

export const STATUS_BADGE: Record<AppointmentStatus, string> = {
  pending: "border border-yellow-500 bg-yellow-50 text-yellow-700",
  in_progress: "border border-blue-500 bg-blue-50 text-blue-700",
  completed: "border border-green-500 bg-green-50 text-green-700",
  cancelled: "border border-red-400 bg-red-50 text-red-700",
  no_show: "border border-slate-400 bg-slate-50 text-slate-600",
}

/** "16:30" → "4:30 م" (12-hour, as people say it in Iraq; Western digits). */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number]
  return new Intl.DateTimeFormat("ar-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

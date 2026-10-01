// Date helpers for "calendar dates" (birth dates, X-ray dates) that have no time zone.
// They are stored as Postgres DATE and handled here as "YYYY-MM-DD" strings / UTC midnight.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Today in the clinic's time zone as "YYYY-MM-DD". */
export function todayIso(timeZone = "Asia/Baghdad", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/** "YYYY-MM-DD" → Date at UTC midnight, or null if not a real calendar date. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Whole years between a birth date and today (both "YYYY-MM-DD"). */
export function ageInYears(birthIso: string, todayIsoValue: string): number {
  const [by, bm, bd] = birthIso.split("-").map(Number) as [number, number, number]
  const [ty, tm, td] = todayIsoValue.split("-").map(Number) as [number, number, number]
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}

/** Birth date estimated from an age: the same day, `age` years ago. */
export function birthDateFromAge(age: number, todayIsoValue: string): string {
  const [y, m, d] = todayIsoValue.split("-").map(Number) as [number, number, number]
  // 29 Feb in a non-leap target year → 28 Feb.
  const target = new Date(Date.UTC(y - age, m - 1, d))
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0)
  return toIsoDate(target)
}

/** UTC offset of a time zone at a moment, in minutes (Baghdad → 180). */
function offsetMinutes(timeZone: string, at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? "")
  if (!m) return 0
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** The instant a clinic calendar day starts: "2026-10-01" in Baghdad → 2026-09-30T21:00Z. */
export function startOfDayUtc(isoDate: string, timeZone = "Asia/Baghdad"): Date {
  const utcMidnight = new Date(`${isoDate}T00:00:00Z`)
  return new Date(utcMidnight.getTime() - offsetMinutes(timeZone, utcMidnight) * 60_000)
}

/** Start of the clinic's current month, as an instant. */
export function startOfMonthUtc(timeZone = "Asia/Baghdad", now = new Date()): Date {
  return startOfDayUtc(`${todayIso(timeZone, now).slice(0, 7)}-01`, timeZone)
}

/** "2026-10-01" + 3 → "2026-10-04" (calendar arithmetic, no time zones involved). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return toIsoDate(d)
}

/** Day of the week of a calendar date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay()
}

/** The clinic calendar date an instant falls on. */
export function isoDateInZone(instant: Date, timeZone = "Asia/Baghdad"): string {
  return todayIso(timeZone, instant)
}

/** Minutes after midnight (clinic time) of an instant: 16:30 → 990. */
export function minutesInZone(instant: Date, timeZone = "Asia/Baghdad"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get("hour") * 60 + get("minute")
}

/** A clinic-local date + minutes after midnight → the instant. */
export function zonedInstant(isoDate: string, minutes: number, timeZone = "Asia/Baghdad"): Date {
  return new Date(startOfDayUtc(isoDate, timeZone).getTime() + minutes * 60_000)
}

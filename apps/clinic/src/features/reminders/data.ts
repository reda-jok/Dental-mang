import "server-only"

import {
  addDays,
  minutesInZone,
  parseIsoDate,
  startOfDayUtc,
  toIsoDate,
  todayIso,
} from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { minutesToHhmm } from "../appointments/rules"
import { nextOpenDay, reminderState, summarize } from "./rules"

const tz = () => env.CLINIC_TIMEZONE

/** The day reminders are usually sent for: the next day the clinic is open. */
export async function getReminderDefaultDay() {
  await authorize("appointment:write")
  const today = todayIso(tz())
  const [settings, holidays] = await Promise.all([
    db.clinicSettings.findUnique({ where: { id: 1 }, select: { weeklyOffDays: true } }),
    db.clinicHoliday.findMany({
      where: { date: { gt: parseIsoDate(today)!, lte: parseIsoDate(addDays(today, 31))! } },
      select: { date: true },
    }),
  ])
  return nextOpenDay(
    today,
    new Set(holidays.map((h) => toIsoDate(h.date))),
    settings?.weeklyOffDays ?? [5],
  )
}

/**
 * The day's appointments still waiting (cancelled, no-shows and visits under way are left
 * out), each with whether a reminder was sent, when and by whom.
 */
export async function getReminderDay(date: string) {
  await authorize("appointment:write")
  const rows = await db.appointment.findMany({
    where: {
      status: "pending",
      startsAt: { gte: startOfDayUtc(date, tz()), lt: startOfDayUtc(addDays(date, 1), tz()) },
      patient: { deletedAt: null },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      startsAt: true,
      patient: { select: { id: true, fullName: true, code: true, phone: true } },
      dentist: { select: { name: true } },
      procedure: { select: { name: true } },
      reminders: {
        orderBy: { sentAt: "desc" },
        select: { sentAt: true, sentBy: { select: { name: true } } },
      },
    },
  })
  const list = rows.map((a) => ({
    id: a.id,
    startsAt: a.startsAt,
    time: minutesToHhmm(minutesInZone(a.startsAt, tz())),
    patient: a.patient,
    dentistName: a.dentist?.name ?? null,
    procedureName: a.procedure?.name ?? null,
    sentCount: a.reminders.length,
    lastSentAt: a.reminders[0]?.sentAt ?? null,
    lastSentBy: a.reminders[0]?.sentBy?.name ?? null,
    state: reminderState({ phone: a.patient.phone, sentCount: a.reminders.length }),
  }))
  return { rows: list, summary: summarize(list) }
}

export type ReminderRow = Awaited<ReturnType<typeof getReminderDay>>["rows"][number]

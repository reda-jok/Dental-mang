import "server-only"

import { connection } from "next/server"

import { searchTokens } from "@/lib/arabic"
import {
  addDays,
  isoDateInZone,
  minutesInZone,
  parseIsoDate,
  startOfDayUtc,
  toIsoDate,
} from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import {
  BLOCKING_STATUSES,
  generateSlots,
  isRestDay,
  minutesToHhmm,
  slotAvailability,
} from "./rules"

const tz = () => env.CLINIC_TIMEZONE

export async function getScheduleConfig() {
  await connection()
  const s = await db.clinicSettings.findUnique({
    where: { id: 1 },
    select: {
      name: true,
      dayStartMinutes: true,
      dayEndMinutes: true,
      slotMinutes: true,
      weeklyOffDays: true,
    },
  })
  return {
    clinicName: s?.name ?? "",
    dayStart: s?.dayStartMinutes ?? 930,
    dayEnd: s?.dayEndMinutes ?? 1320,
    slotMinutes: s?.slotMinutes ?? 30,
    weeklyOffDays: s?.weeklyOffDays ?? [5],
    timeZone: tz(),
  }
}

export type ScheduleConfig = Awaited<ReturnType<typeof getScheduleConfig>>

const appointmentSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  priority: true,
  notes: true,
  patient: { select: { id: true, fullName: true, code: true, phone: true } },
  dentist: { select: { id: true, name: true } },
  room: { select: { id: true, name: true } },
  procedure: { select: { id: true, name: true } },
} as const

/** Appointments whose day (clinic time) is in [fromIso, toIso]. */
export async function listAppointments(fromIso: string, toIso: string) {
  await authorize("appointment:read")
  const rows = await db.appointment.findMany({
    where: {
      startsAt: { gte: startOfDayUtc(fromIso, tz()), lt: startOfDayUtc(addDays(toIso, 1), tz()) },
      patient: { deletedAt: null },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    select: appointmentSelect,
  })
  return rows.map((a) => ({
    ...a,
    date: isoDateInZone(a.startsAt, tz()),
    time: minutesToHhmm(minutesInZone(a.startsAt, tz())),
    durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
  }))
}

export type AppointmentView = Awaited<ReturnType<typeof listAppointments>>[number]

/** A patient's appointments, newest first, each marked upcoming (still to happen) or not. */
export async function listPatientAppointments(patientId: string) {
  await authorize("appointment:read")
  await connection()
  const now = Date.now()
  const rows = await db.appointment.findMany({
    where: { patientId },
    orderBy: { startsAt: "desc" },
    take: 100,
    select: appointmentSelect,
  })
  return rows.map((a) => ({
    ...a,
    upcoming: a.endsAt.getTime() >= now && (a.status === "pending" || a.status === "in_progress"),
    date: isoDateInZone(a.startsAt, tz()),
    time: minutesToHhmm(minutesInZone(a.startsAt, tz())),
    durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
  }))
}

/** One-off rest days in [fromIso, toIso]. */
export async function listHolidays(fromIso: string, toIso: string) {
  await authorize("appointment:read")
  const rows = await db.clinicHoliday.findMany({
    where: { date: { gte: parseIsoDate(fromIso)!, lte: parseIsoDate(toIso)! } },
    select: { date: true, reason: true },
  })
  return rows.map((h) => ({ date: toIsoDate(h.date), reason: h.reason }))
}

/** What the booking form offers: dentists, rooms and the procedure catalog. */
export async function getBookingOptions() {
  await authorize("appointment:write")
  const [dentists, rooms, procedures] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["dentist", "owner"] }, OR: [{ banned: false }, { banned: null }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.room.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.procedure.findMany({
      where: { archivedAt: null },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, durationMinutes: true },
    }),
  ])
  return { dentists, rooms, procedures }
}

export type BookingOptions = Awaited<ReturnType<typeof getBookingOptions>>

/**
 * Free/taken slots for a day, for a dentist and/or room, plus who is already
 * booked that day (the form greys those patients out).
 */
export async function getAvailability(input: {
  date: string
  durationMinutes: number
  dentistId: string | null
  roomId: string | null
}) {
  await authorize("appointment:read")
  const config = await getScheduleConfig()
  const holiday = await db.clinicHoliday.findUnique({ where: { date: parseIsoDate(input.date)! } })
  const restDay = isRestDay(input.date, new Set(holiday ? [input.date] : []), config.weeklyOffDays)

  const dayStart = startOfDayUtc(input.date, tz())
  const dayEnd = startOfDayUtc(addDays(input.date, 1), tz())
  const sameDay = await db.appointment.findMany({
    where: { startsAt: { gte: dayStart, lt: dayEnd }, status: { in: BLOCKING_STATUSES } },
    select: { patientId: true, dentistId: true, roomId: true, startsAt: true, endsAt: true },
  })

  const busy = sameDay
    .filter(
      (a) =>
        (input.dentistId && a.dentistId === input.dentistId) ||
        (input.roomId && a.roomId === input.roomId) ||
        // No dentist/room chosen: one chair, so any appointment blocks the time.
        (!input.dentistId && !input.roomId),
    )
    .map((a) => ({
      start: minutesInZone(a.startsAt, tz()),
      end:
        minutesInZone(a.startsAt, tz()) +
        Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
    }))

  const slots = slotAvailability(
    generateSlots(config.dayStart, config.dayEnd, config.slotMinutes),
    input.durationMinutes,
    busy,
    config.dayEnd,
  ).map((s) => ({ time: minutesToHhmm(s.start), taken: s.taken }))

  return {
    restDay,
    holidayReason: holiday?.reason ?? null,
    slots,
    bookedCount: sameDay.length,
    bookedPatientIds: [...new Set(sameDay.map((a) => a.patientId))],
  }
}

export async function searchPatientsForBooking(q: string, date: string | undefined) {
  await authorize("patient:read")
  const tokens = searchTokens(q)
  if (tokens.length === 0) return []
  const patients = await db.patient.findMany({
    where: { deletedAt: null, AND: tokens.map((t) => ({ searchText: { contains: t } })) },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, fullName: true, code: true, phone: true },
  })
  if (!date) return patients.map((p) => ({ ...p, hasAppointment: false }))
  const booked = await db.appointment.findMany({
    where: {
      patientId: { in: patients.map((p) => p.id) },
      status: { in: BLOCKING_STATUSES },
      startsAt: { gte: startOfDayUtc(date, tz()), lt: startOfDayUtc(addDays(date, 1), tz()) },
    },
    select: { patientId: true },
  })
  const bookedIds = new Set(booked.map((b) => b.patientId))
  return patients.map((p) => ({ ...p, hasAppointment: bookedIds.has(p.id) }))
}

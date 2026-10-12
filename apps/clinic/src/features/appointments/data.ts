import "server-only"

import { connection } from "next/server"

import type { Prisma } from "@/generated/prisma/client"
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
  availabilityFor,
  BLOCKING_STATUSES,
  generateSlots,
  isRestDay,
  minutesToHhmm,
  type AppointmentStatus,
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
  reason: true,
  items: {
    orderBy: { planItem: { phase: "asc" } },
    select: { planItem: { select: { tooth: true, procedure: { select: { name: true } } } } },
  },
} as const

type AppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>

const toView = ({ items, ...a }: AppointmentRow) => ({
  ...a,
  items: items.map((i) => ({ name: i.planItem.procedure.name, tooth: i.planItem.tooth })),
  date: isoDateInZone(a.startsAt, tz()),
  time: minutesToHhmm(minutesInZone(a.startsAt, tz())),
  durationMinutes: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
})

/** Statuses after which the card says whether the patient has another visit booked. */
const OVER: AppointmentStatus[] = ["completed", "cancelled", "no_show"]

/**
 * Appointments whose day (clinic time) is in [fromIso, toIso]. A visit that is over carries
 * the patient's next booked visit (or null), so the calendar shows who still needs one.
 */
export async function listAppointments(fromIso: string, toIso: string) {
  await authorize("appointment:read")
  const rows = (
    await db.appointment.findMany({
      where: {
        startsAt: {
          gte: startOfDayUtc(fromIso, tz()),
          lt: startOfDayUtc(addDays(toIso, 1), tz()),
        },
        patient: { deletedAt: null },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      select: appointmentSelect,
    })
  ).map(toView)

  const over = rows.filter((a) => OVER.includes(a.status))
  const upcoming = over.length
    ? await db.appointment.findMany({
        where: {
          patientId: { in: [...new Set(over.map((a) => a.patient.id))] },
          status: "pending",
          startsAt: { gt: over[0]!.startsAt },
        },
        orderBy: { startsAt: "asc" },
        select: { patientId: true, startsAt: true },
      })
    : []
  return rows.map((a) => {
    if (!OVER.includes(a.status)) return { ...a, next: undefined }
    const next = upcoming.find((u) => u.patientId === a.patient.id && u.startsAt > a.startsAt)
    return {
      ...a,
      next: next
        ? {
            date: isoDateInZone(next.startsAt, tz()),
            time: minutesToHhmm(minutesInZone(next.startsAt, tz())),
          }
        : null,
    }
  })
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
    ...toView(a),
    next: undefined,
    upcoming: a.endsAt.getTime() >= now && (a.status === "pending" || a.status === "in_progress"),
  }))
}

/** The patient's visit today that is waiting or under way, for Start / Finish on the patient page. */
export async function getTodayVisit(patientId: string) {
  await authorize("appointment:read")
  await connection()
  const today = isoDateInZone(new Date(), tz())
  const row = await db.appointment.findFirst({
    where: {
      patientId,
      status: { in: ["pending", "in_progress"] },
      startsAt: { gte: startOfDayUtc(today, tz()), lt: startOfDayUtc(addDays(today, 1), tz()) },
    },
    orderBy: { startsAt: "asc" },
    select: appointmentSelect,
  })
  return row ? { ...toView(row), next: undefined } : null
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

/** What the booking form offers: dentists and rooms. */
export async function getBookingOptions() {
  await authorize("appointment:write")
  const [dentists, rooms] = await Promise.all([
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
  ])
  return { dentists, rooms }
}

/** Visits a treatment has had: those where it was done or worked on. */
const visitsSoFar = (visits: { outcome: string | null }[]) =>
  visits.filter((v) => v.outcome === "done" || v.outcome === "continued").length

/**
 * The patient's unfinished treatments in open plans (accepted plans first), for the booking
 * form: how many visits each has had, and the date of a later visit already booked for it.
 */
export async function getBookingItems(patientId: string) {
  await authorize("appointment:write")
  await connection()
  const today = startOfDayUtc(isoDateInZone(new Date(), tz()), tz())
  const plans = await db.treatmentPlan.findMany({
    where: { patientId, status: { in: ["accepted", "proposed"] }, patient: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      items: {
        where: { status: { in: ["planned", "in_progress"] } },
        orderBy: [{ phase: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          phase: true,
          tooth: true,
          surfaces: true,
          status: true,
          procedure: {
            select: { name: true, durationMinutes: true, visitsMin: true, visitsMax: true },
          },
          visits: {
            select: { outcome: true, appointment: { select: { status: true, startsAt: true } } },
          },
        },
      },
    },
  })
  return plans
    .sort((a, b) => Number(b.status === "accepted") - Number(a.status === "accepted"))
    .flatMap((plan) =>
      plan.items.map(({ procedure, visits, ...item }) => {
        const ahead = visits
          .filter((v) => v.appointment.status === "pending" && v.appointment.startsAt >= today)
          .map((v) => v.appointment.startsAt)
          .sort((a, b) => a.getTime() - b.getTime())[0]
        return {
          ...item,
          planId: plan.id,
          planTitle: plan.title,
          name: procedure.name,
          durationMinutes: procedure.durationMinutes,
          visitsMin: procedure.visitsMin,
          visitsMax: procedure.visitsMax,
          visitsSoFar: visitsSoFar(visits),
          bookedOn: ahead ? isoDateInZone(ahead, tz()) : null,
          bookedAhead: !!ahead,
        }
      }),
    )
}

export type BookingItem = Awaited<ReturnType<typeof getBookingItems>>[number]

/**
 * Treatments that can be recorded when a visit is finished: the ones booked for it, the
 * patient's other open treatments, and any already marked done on the visit's day.
 */
export function finishCandidates(
  patientId: string,
  booked: string[],
  since: Date,
): Prisma.TreatmentPlanItemWhereInput {
  return {
    OR: [
      { id: { in: booked } },
      {
        status: { in: ["planned", "in_progress"] },
        plan: { patientId, status: { in: ["proposed", "accepted"] } },
      },
      { status: "done", completedAt: { gte: since }, plan: { patientId } },
    ],
  }
}

/** What the finish dialog lists for a visit (see finishCandidates). */
export async function getFinishOptions(appointmentId: string) {
  await authorize("clinical:write")
  const visit = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: { patientId: true, startsAt: true, items: { select: { planItemId: true } } },
  })
  if (!visit) return null
  const booked = visit.items.map((i) => i.planItemId)
  const since = startOfDayUtc(isoDateInZone(visit.startsAt, tz()), tz())
  const items = await db.treatmentPlanItem.findMany({
    where: finishCandidates(visit.patientId, booked, since),
    orderBy: [{ phase: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      tooth: true,
      surfaces: true,
      status: true,
      completedAt: true,
      plan: { select: { status: true } },
      procedure: { select: { name: true, visitsMin: true, visitsMax: true } },
      visits: { select: { outcome: true } },
    },
  })
  return items.map(({ procedure, visits, plan, completedAt, ...item }) => ({
    ...item,
    name: procedure.name,
    visitsMin: procedure.visitsMin,
    visitsMax: procedure.visitsMax,
    visitsSoFar: visitsSoFar(visits),
    booked: booked.includes(item.id),
    doneToday: item.status === "done" && !!completedAt && completedAt >= since,
    open:
      (item.status === "planned" || item.status === "in_progress") &&
      (plan.status === "proposed" || plan.status === "accepted"),
  }))
}

export type FinishOption = NonNullable<Awaited<ReturnType<typeof getFinishOptions>>>[number]

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

  const [dentists, rooms] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["dentist", "owner"] }, OR: [{ banned: false }, { banned: null }] },
      select: { id: true },
    }),
    db.room.findMany({ where: { archivedAt: null }, select: { id: true } }),
  ])
  const slots = availabilityFor(
    generateSlots(config.dayStart, config.dayEnd, config.slotMinutes),
    input.durationMinutes,
    sameDay.map((a) => {
      const start = minutesInZone(a.startsAt, tz())
      return {
        dentistId: a.dentistId,
        roomId: a.roomId,
        start,
        end: start + Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000),
      }
    }),
    { dentistId: input.dentistId, roomId: input.roomId },
    { dentistIds: dentists.map((d) => d.id), roomIds: rooms.map((r) => r.id) },
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

import "server-only"

import type { z } from "zod"

import { addDays, parseIsoDate, startOfDayUtc, todayIso, zonedInstant } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { BLOCKING_STATUSES, canChangeStatus, hhmmToMinutes, isRestDay, overlaps } from "./rules"
import type {
  bookAppointmentSchema,
  restDaySchema,
  roomSchema,
  scheduleSettingsSchema,
  setStatusSchema,
} from "./schemas"

const tz = () => env.CLINIC_TIMEZONE

/** The database's no-overlap constraints (see the appointments migration). */
function isOverlapViolation(error: unknown): boolean {
  const text = `${(error as Error)?.message ?? ""} ${JSON.stringify(error ?? {})}`
  return /appointment_(dentist|room)_no_overlap|23P01/.test(text)
}

export async function bookAppointment(
  actor: CurrentUser,
  input: z.output<typeof bookAppointmentSchema>,
) {
  const startMinutes = hhmmToMinutes(input.time)!
  const startsAt = zonedInstant(input.date, startMinutes, tz())
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000)

  try {
    return await db.$transaction(async (tx) => {
      const [patient, settings, holiday] = await Promise.all([
        tx.patient.findFirst({
          where: { id: input.patientId, deletedAt: null },
          select: { id: true },
        }),
        tx.clinicSettings.findUniqueOrThrow({ where: { id: 1 } }),
        tx.clinicHoliday.findUnique({ where: { date: parseIsoDate(input.date)! } }),
      ])
      if (!patient) throw new AppError("not_found")

      if (isRestDay(input.date, new Set(holiday ? [input.date] : []), settings.weeklyOffDays)) {
        throw new AppError("conflict", "clinicClosed", { date: ["clinicClosed"] })
      }
      if (
        startMinutes < settings.dayStartMinutes ||
        startMinutes + input.durationMinutes > settings.dayEndMinutes
      ) {
        throw new AppError("validation", "outsideWorkingHours", { time: ["outsideWorkingHours"] })
      }
      if (input.date < todayIso(tz()) || startsAt.getTime() < Date.now() - 5 * 60_000) {
        throw new AppError("validation", "appointmentInPast", { time: ["appointmentInPast"] })
      }

      const sameDay = await tx.appointment.findMany({
        where: {
          startsAt: {
            gte: startOfDayUtc(input.date, tz()),
            lt: startOfDayUtc(addDays(input.date, 1), tz()),
          },
          status: { in: BLOCKING_STATUSES },
        },
        select: { patientId: true, dentistId: true, roomId: true, startsAt: true, endsAt: true },
      })
      // One visit per patient per day (as in the clinic's original booking form).
      if (sameDay.some((a) => a.patientId === input.patientId)) {
        throw new AppError("conflict", "patientAlreadyBooked", {
          patientId: ["patientAlreadyBooked"],
        })
      }
      const wanted = { start: startsAt.getTime(), end: endsAt.getTime() }
      const clash = sameDay.find(
        (a) =>
          overlaps(wanted, { start: a.startsAt.getTime(), end: a.endsAt.getTime() }) &&
          ((input.dentistId && a.dentistId === input.dentistId) ||
            (input.roomId && a.roomId === input.roomId) ||
            (!input.dentistId && !input.roomId && !a.dentistId && !a.roomId)),
      )
      if (clash) throw new AppError("conflict", "slotTaken", { time: ["slotTaken"] })

      if (input.dentistId) {
        const dentist = await tx.user.findFirst({
          where: {
            id: input.dentistId,
            role: { in: ["dentist", "owner"] },
            OR: [{ banned: false }, { banned: null }],
          },
          select: { id: true },
        })
        if (!dentist)
          throw new AppError("validation", "dentistMissing", { dentistId: ["dentistMissing"] })
      }

      const appointment = await tx.appointment.create({
        data: {
          patientId: input.patientId,
          dentistId: input.dentistId,
          roomId: input.roomId,
          procedureId: input.procedureId,
          startsAt,
          endsAt,
          priority: input.priority,
          notes: input.notes,
          createdById: actor.id,
        },
        select: { id: true },
      })
      await recordAudit(tx, {
        userId: actor.id,
        action: "create",
        entity: "appointment",
        entityId: appointment.id,
        after: { ...input, startsAt, endsAt },
      })
      return appointment
    })
  } catch (error) {
    // Two bookings at the same moment: the database constraint catches the second.
    if (isOverlapViolation(error))
      throw new AppError("conflict", "slotTaken", { time: ["slotTaken"] })
    throw error
  }
}

export async function setAppointmentStatus(
  actor: CurrentUser,
  input: z.output<typeof setStatusSchema>,
) {
  return db.$transaction(async (tx) => {
    const current = await tx.appointment.findUnique({
      where: { id: input.id },
      select: { status: true, patientId: true },
    })
    if (!current) throw new AppError("not_found")
    if (!canChangeStatus(current.status, input.status))
      throw new AppError("conflict", "statusChangeNotAllowed")

    await tx.appointment.update({ where: { id: input.id }, data: { status: input.status } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "appointment",
      entityId: input.id,
      before: { status: current.status },
      after: { status: input.status },
    })
    return { patientId: current.patientId }
  })
}

/**
 * Close or reopen a day. Closing a day that has bookings is allowed (clinics close
 * unexpectedly); the caller is told how many patients need rescheduling.
 */
export async function setRestDay(actor: CurrentUser, input: z.output<typeof restDaySchema>) {
  const date = parseIsoDate(input.date)!
  return db.$transaction(async (tx) => {
    if (input.closed) {
      await tx.clinicHoliday.upsert({
        where: { date },
        create: { date, reason: input.reason, createdById: actor.id },
        update: { reason: input.reason },
      })
    } else {
      await tx.clinicHoliday.deleteMany({ where: { date } })
    }
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "clinic_holiday",
      entityId: input.date,
      after: { closed: input.closed, reason: input.reason },
    })
    const affected = input.closed
      ? await tx.appointment.count({
          where: {
            startsAt: {
              gte: startOfDayUtc(input.date, tz()),
              lt: startOfDayUtc(addDays(input.date, 1), tz()),
            },
            status: "pending",
          },
        })
      : 0
    return { affected }
  })
}

export async function updateScheduleSettings(
  actor: CurrentUser,
  input: z.output<typeof scheduleSettingsSchema>,
) {
  const data = {
    dayStartMinutes: hhmmToMinutes(input.dayStart)!,
    dayEndMinutes: hhmmToMinutes(input.dayEnd)!,
    slotMinutes: input.slotMinutes,
    weeklyOffDays: [...new Set(input.weeklyOffDays)].sort(),
  }
  await db.$transaction(async (tx) => {
    const before = await tx.clinicSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: {
        dayStartMinutes: true,
        dayEndMinutes: true,
        slotMinutes: true,
        weeklyOffDays: true,
      },
    })
    await tx.clinicSettings.update({ where: { id: 1 }, data })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "schedule_settings",
      entityId: "1",
      before,
      after: data,
    })
  })
}

export async function addRoom(actor: CurrentUser, input: z.output<typeof roomSchema>) {
  const exists = await db.room.findUnique({ where: { name: input.name } })
  if (exists && !exists.archivedAt)
    throw new AppError("conflict", "roomExists", { name: ["roomExists"] })
  await db.$transaction(async (tx) => {
    const count = await tx.room.count()
    const room = exists
      ? await tx.room.update({ where: { id: exists.id }, data: { archivedAt: null } })
      : await tx.room.create({ data: { name: input.name, sortOrder: count } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "room",
      entityId: room.id,
      after: input,
    })
  })
}

export async function archiveRoom(actor: CurrentUser, id: string) {
  await db.$transaction(async (tx) => {
    const updated = await tx.room.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    })
    if (updated.count === 0) throw new AppError("not_found")
    await recordAudit(tx, { userId: actor.id, action: "delete", entity: "room", entityId: id })
  })
}

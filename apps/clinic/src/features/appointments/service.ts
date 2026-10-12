import "server-only"

import type { z } from "zod"

import {
  addDays,
  isoDateInZone,
  parseIsoDate,
  startOfDayUtc,
  todayIso,
  zonedInstant,
} from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { changeItemStatus } from "../plans/service"
import { finishCandidates } from "./data"
import {
  BLOCKING_STATUSES,
  canChangeStatus,
  finishProblem,
  hhmmToMinutes,
  isRestDay,
  overlaps,
  type VisitOutcome,
} from "./rules"
import type {
  bookAppointmentSchema,
  finishVisitSchema,
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
      // One query at a time: a transaction runs on a single connection.
      const patient = await tx.patient.findFirst({
        where: { id: input.patientId, deletedAt: null },
        select: { id: true },
      })
      const settings = await tx.clinicSettings.findUniqueOrThrow({ where: { id: 1 } })
      const holiday = await tx.clinicHoliday.findUnique({
        where: { date: parseIsoDate(input.date)! },
      })
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

      // The treatments are this patient's, in a plan still open, and not finished yet.
      const itemIds = [...new Set(input.itemIds)]
      if (itemIds.length > 0) {
        const open = await tx.treatmentPlanItem.count({
          where: {
            id: { in: itemIds },
            status: { in: ["planned", "in_progress"] },
            plan: { patientId: input.patientId, status: { in: ["proposed", "accepted"] } },
          },
        })
        if (open !== itemIds.length)
          throw new AppError("conflict", "itemsChanged", { itemIds: ["itemsChanged"] })
      }

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
          reason: input.reason,
          items: { create: itemIds.map((planItemId) => ({ planItemId })) },
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
 * Finishes a visit with what was done: each treatment booked for it is done, needs another
 * visit, or wasn't done today; other open treatments of the plan can be recorded too. The
 * treatments change in the same transaction (chart, plan completion), and every treatment
 * worked on is linked to the visit, so the plan can count its visits.
 */
export async function finishVisit(actor: CurrentUser, input: z.output<typeof finishVisitSchema>) {
  // The dentist records the work; reception can't finish a visit.
  if (!hasPermission(actor, "clinical:write")) throw new AppError("forbidden")
  return db.$transaction(async (tx) => {
    const visit = await tx.appointment.findUnique({
      where: { id: input.id },
      select: {
        status: true,
        patientId: true,
        startsAt: true,
        items: { select: { planItemId: true } },
      },
    })
    if (!visit) throw new AppError("not_found")
    if (!canChangeStatus(visit.status, "completed"))
      throw new AppError("conflict", "statusChangeNotAllowed")

    const booked = visit.items.map((i) => i.planItemId)
    const since = startOfDayUtc(isoDateInZone(visit.startsAt, tz()), tz())
    const items = await tx.treatmentPlanItem.findMany({
      where: finishCandidates(visit.patientId, booked, since),
      select: { id: true, status: true, completedAt: true, plan: { select: { status: true } } },
    })
    const isOpen = (id: string) =>
      items.some(
        (i) =>
          i.id === id &&
          (i.status === "planned" || i.status === "in_progress") &&
          (i.plan.status === "proposed" || i.plan.status === "accepted"),
      )
    const doneToday = items.filter((i) => i.status === "done" && i.completedAt! >= since)
    const outcomes: Record<string, VisitOutcome> = Object.fromEntries(
      input.outcomes.map((o) => [o.itemId, o.outcome]),
    )
    if (input.outcomes.some((o) => !isOpen(o.itemId)))
      throw new AppError("conflict", "itemsChanged")
    const problem = finishProblem({
      open: booked.filter(isOpen),
      outcomes,
      doneToday: doneToday.length,
      noTreatment: input.noTreatment,
    })
    if (problem) throw new AppError("validation", problem)

    // One query at a time: a transaction runs on a single connection.
    const link = (planItemId: string, outcome: VisitOutcome) =>
      tx.appointmentItem.upsert({
        where: { appointmentId_planItemId: { appointmentId: input.id, planItemId } },
        create: { appointmentId: input.id, planItemId, outcome },
        update: { outcome },
      })
    for (const [itemId, outcome] of Object.entries(outcomes)) {
      if (outcome === "done") await changeItemStatus(tx, actor, { itemId, status: "done" })
      if (outcome === "continued" && items.find((i) => i.id === itemId)!.status === "planned")
        await changeItemStatus(tx, actor, { itemId, status: "in_progress" })
      if (outcome !== "not_done" || booked.includes(itemId)) await link(itemId, outcome)
    }
    // Work already marked done on the plan today belongs to this visit too.
    for (const item of doneToday) if (!outcomes[item.id]) await link(item.id, "done")
    // Booked treatments cancelled (or finished earlier) in the meantime weren't done today.
    for (const id of booked)
      if (!outcomes[id] && !doneToday.some((i) => i.id === id)) await link(id, "not_done")

    await tx.appointment.update({ where: { id: input.id }, data: { status: "completed" } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "appointment",
      entityId: input.id,
      before: { status: visit.status },
      after: { status: "completed", outcomes, noTreatment: input.noTreatment },
    })
    return { patientId: visit.patientId }
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

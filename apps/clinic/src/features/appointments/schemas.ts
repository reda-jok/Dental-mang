import { z } from "zod"

import { isoDate, optionalMultiline, optionalText, text, uuid } from "@/lib/validation"

import { hhmmToMinutes } from "./rules"

const time = z.string({ error: "required" }).refine((v) => hhmmToMinutes(v) !== null, "invalidTime")

const optionalId = z
  .union([uuid, z.literal("")])
  .optional()
  .transform((v) => v || null)

export const duration = z.coerce
  .number({ error: "required" })
  .int()
  .min(5, "invalidDuration")
  .max(480, "invalidDuration")

export const VISIT_REASONS = ["checkup", "consultation", "emergency", "other"] as const
export const VISIT_OUTCOMES = ["done", "continued", "not_done"] as const

/** A visit is for plan treatments, or (with none ticked) for a reason. */
export const bookAppointmentSchema = z
  .strictObject({
    patientId: uuid,
    date: isoDate,
    time,
    durationMinutes: duration,
    dentistId: optionalId,
    roomId: optionalId,
    itemIds: z.array(uuid).max(32).default([]),
    reason: z
      .union([z.enum(VISIT_REASONS), z.literal("")])
      .optional()
      .transform((v) => v || null),
    priority: z.enum(["normal", "urgent"]).default("normal"),
    notes: optionalMultiline(500),
  })
  .refine((v) => v.itemIds.length > 0 || v.reason, {
    path: ["reason"],
    message: "reasonRequired",
  })
  .transform((v) => ({ ...v, reason: v.itemIds.length > 0 ? null : v.reason }))

export const APPOINTMENT_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const

/** Finishing goes through finishVisitSchema, which records what was done. */
export const setStatusSchema = z.strictObject({
  id: uuid,
  status: z.enum(APPOINTMENT_STATUSES).exclude(["completed"]),
})

export const finishVisitSchema = z.strictObject({
  id: uuid,
  outcomes: z.array(z.strictObject({ itemId: uuid, outcome: z.enum(VISIT_OUTCOMES) })).max(64),
  noTreatment: z.boolean(),
})

export const appointmentIdSchema = z.strictObject({ id: uuid })
export const bookingItemsSchema = z.strictObject({ patientId: uuid })

export const availabilitySchema = z.strictObject({
  date: isoDate,
  durationMinutes: duration,
  dentistId: optionalId,
  roomId: optionalId,
})

export const restDaySchema = z.strictObject({
  date: isoDate,
  closed: z.boolean(),
  reason: optionalText(100),
})

const hhmm = z.string().refine((v) => hhmmToMinutes(v) !== null, "invalidTime")

export const scheduleSettingsSchema = z
  .strictObject({
    dayStart: hhmm,
    dayEnd: hhmm,
    slotMinutes: z.coerce.number().int().min(5, "invalidDuration").max(240, "invalidDuration"),
    weeklyOffDays: z.array(z.number().int().min(0).max(6)).max(6),
  })
  .refine((v) => hhmmToMinutes(v.dayStart)! < hhmmToMinutes(v.dayEnd)!, {
    path: ["dayEnd"],
    message: "endBeforeStart",
  })

export const roomSchema = z.strictObject({ name: text(1, 50) })
export const archiveRoomSchema = z.strictObject({ id: uuid })

export type BookAppointmentInput = z.input<typeof bookAppointmentSchema>

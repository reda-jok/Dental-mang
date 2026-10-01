import { z } from "zod"

import { parseIsoDate } from "@/lib/dates"
import { optionalMultiline, optionalText, text, toLatinDigits, uuid } from "@/lib/validation"

import { hhmmToMinutes } from "./rules"

export const isoDate = z
  .string({ error: "required" })
  .transform((v) => toLatinDigits(v).trim())
  .refine((v) => parseIsoDate(v) !== null, "invalidDate")

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

export const bookAppointmentSchema = z.strictObject({
  patientId: uuid,
  date: isoDate,
  time,
  durationMinutes: duration,
  dentistId: optionalId,
  roomId: optionalId,
  procedureId: optionalId,
  priority: z.enum(["normal", "urgent"]).default("normal"),
  notes: optionalMultiline(500),
})

export const APPOINTMENT_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const

export const setStatusSchema = z.strictObject({ id: uuid, status: z.enum(APPOINTMENT_STATUSES) })

export const availabilitySchema = z.strictObject({
  date: isoDate,
  durationMinutes: duration,
  dentistId: optionalId,
  roomId: optionalId,
})

export const bookingPatientSearchSchema = z.strictObject({
  q: z.string().max(100),
  date: isoDate.optional(),
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

import { z } from "zod"

import { multiline, uuid } from "@/lib/validation"

export const NOTE_MAX_LENGTH = 5000

const body = multiline(2, NOTE_MAX_LENGTH)

export const createClinicalNoteSchema = z.strictObject({
  patientId: uuid,
  /** The appointment the visit was for; empty = a visit today without an appointment. */
  appointmentId: z
    .union([uuid, z.literal("")])
    .optional()
    .transform((v) => v || null),
  body,
})

export const reviseClinicalNoteSchema = z.strictObject({
  id: uuid,
  /** The version the user was looking at; a newer one means someone else changed it. */
  version: z.int().min(1),
  body,
})

export const deleteClinicalNoteSchema = z.strictObject({ id: uuid })

export type CreateClinicalNoteInput = z.input<typeof createClinicalNoteSchema>
export type ReviseClinicalNoteInput = z.input<typeof reviseClinicalNoteSchema>

import { z } from "zod"

import { parseIsoDate, todayIso } from "@/lib/dates"
import { optionalText, toLatinDigits, uuid } from "@/lib/validation"

export const ATTACHMENT_KINDS = ["xray", "photo", "document"] as const

/** The non-file fields of an upload (multipart form). */
export const uploadFieldsSchema = z.object({
  patientId: uuid,
  kind: z.enum(ATTACHMENT_KINDS),
  takenAt: z
    .string()
    .optional()
    .transform((v) => (v ? toLatinDigits(v).trim() : ""))
    .refine((v) => !v || (parseIsoDate(v) !== null && v <= todayIso()), "invalidDate")
    .transform((v) => (v ? parseIsoDate(v) : null)),
  notes: optionalText(300),
})

export const deleteAttachmentSchema = z.strictObject({ id: uuid })

import { z } from "zod"

import { parseIsoDate, todayIso } from "@/lib/dates"
import {
  optionalMultiline,
  optionalPhone,
  optionalText,
  phone,
  text,
  toLatinDigits,
  uuid,
} from "@/lib/validation"

import { ALLERGY_CODES, CONDITION_CODES } from "./medical"

const birthDate = z
  .string()
  .transform((v) => toLatinDigits(v).trim())
  .refine((v) => parseIsoDate(v) !== null, "invalidDate")
  .refine((v) => v >= "1900-01-01" && v <= todayIso(), "invalidDate")

const age = z
  .string()
  .transform((v) => toLatinDigits(v).trim())
  .pipe(z.string().regex(/^\d{1,3}$/, "invalidAge"))
  .transform(Number)
  .pipe(z.number().int().min(0, "invalidAge").max(120, "invalidAge"))

/**
 * The medical questionnaire. Answering is required: either tick what applies, or
 * explicitly declare "no conditions, allergies or medications" — so "none" is never
 * confused with "never asked".
 */
const medicalFields = z.object({
  noneDeclared: z.boolean(),
  conditions: z.array(z.enum(CONDITION_CODES)).max(CONDITION_CODES.length),
  otherConditions: optionalText(300),
  allergies: z.array(z.enum(ALLERGY_CODES)).max(ALLERGY_CODES.length),
  otherAllergies: optionalText(300),
  medications: optionalMultiline(500),
  pregnant: z.boolean(),
  smoker: z.boolean(),
  notes: optionalMultiline(1000),
})

type MedicalFields = z.output<typeof medicalFields>

function hasMedicalItems(m: MedicalFields) {
  return (
    m.conditions.length > 0 ||
    m.allergies.length > 0 ||
    !!m.otherConditions ||
    !!m.otherAllergies ||
    !!m.medications
  )
}

function requireMedicalAnswer(
  m: MedicalFields,
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
) {
  const items = hasMedicalItems(m)
  if (!m.noneDeclared && !items) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "noneDeclared"],
      message: "medicalAnswerRequired",
    })
  }
  if (m.noneDeclared && items) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "noneDeclared"],
      message: "medicalContradiction",
    })
  }
}

const medicalAnswer = medicalFields.superRefine((m, ctx) => requireMedicalAnswer(m, ctx))

/**
 * Patient fields + birth information: an exact date, or just an age (common when the
 * date isn't known; the server turns it into an estimated date). Both are required.
 * Unknown keys are stripped (the form sends the fields of both birth modes).
 */
function withBirth<S extends z.ZodRawShape>(shape: S) {
  const base = z.object({
    ...shape,
    fullName: text(3, 150),
    gender: z.enum(["male", "female"], { error: "required" }),
    phone,
    phone2: optionalPhone,
    address: optionalText(200),
    referralSource: optionalText(100),
    notes: optionalMultiline(2000),
  })
  return z.discriminatedUnion(
    "birthMode",
    [
      base.extend({ birthMode: z.literal("date"), birthDate }),
      base.extend({ birthMode: z.literal("age"), age }),
    ],
    { error: "required" },
  )
}

export const createPatientSchema = withBirth({
  /** Set after the user has seen possible duplicates and chose to continue. */
  confirmDuplicate: z.boolean().default(false),
  /** Medical history is taken at registration (the intake questionnaire). */
  medical: medicalAnswer,
})

export const updatePatientSchema = withBirth({ id: uuid })

export const archivePatientSchema = z.strictObject({ id: uuid })

export const medicalHistorySchema = medicalFields
  .extend({
    patientId: uuid,
    /** The version the form was opened with; saving fails if someone saved since. */
    baseVersion: z.number().int().min(0),
  })
  .strict()
  .superRefine((m, ctx) => requireMedicalAnswer(m, ctx))

/** URL search params for the patient list; bad values fall back to defaults. */
export const patientSearchSchema = z.object({
  q: z.string().max(100).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type CreatePatientInput = z.input<typeof createPatientSchema>
export type CreatePatientOutput = z.output<typeof createPatientSchema>
export type UpdatePatientInput = z.input<typeof updatePatientSchema>
export type UpdatePatientOutput = z.output<typeof updatePatientSchema>
export type MedicalHistoryInput = z.input<typeof medicalHistorySchema>

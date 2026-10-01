import { z } from "zod"

import { optionalText, uuid } from "@/lib/validation"

import { CONDITION_CODES, isValidTooth, SURFACES } from "./teeth"

export const teethField = z
  .array(z.number().int())
  .max(32, "tooManyTeeth")
  .refine((teeth) => teeth.every(isValidTooth), "invalidTooth")

export const addFindingSchema = z.strictObject({
  patientId: uuid,
  teeth: teethField.refine((t) => t.length > 0, "teethRequired"),
  surfaces: z.array(z.enum(SURFACES)).max(5),
  condition: z.enum(CONDITION_CODES),
  notes: optionalText(300),
})

export const resolveFindingSchema = z.strictObject({ id: uuid })

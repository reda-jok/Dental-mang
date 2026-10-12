import { z } from "zod"

import { optionalText, text, uuid } from "@/lib/validation"

import { CONDITION_COLORS, isValidTooth, SURFACES } from "./teeth"

export const teethField = z
  .array(z.number().int())
  .max(32, "tooManyTeeth")
  .refine((teeth) => teeth.every(isValidTooth), "invalidTooth")

/** A condition code: a built-in name or a clinic condition's id (checked by the service). */
export const conditionCode = z.string().min(1).max(64)

export const addFindingSchema = z.strictObject({
  patientId: uuid,
  teeth: teethField.refine((t) => t.length > 0, "teethRequired"),
  surfaces: z.array(z.enum(SURFACES)).max(5),
  condition: conditionCode,
  notes: optionalText(300),
})

export const resolveFindingSchema = z.strictObject({ id: uuid })

const conditionColor = z.enum(CONDITION_COLORS, "required")

export const createConditionSchema = z.strictObject({
  name: text(1, 40),
  color: conditionColor,
  scope: z.enum(["surfaces", "tooth"]),
  kind: z.enum(["problem", "existing"]),
})

/** Scope and kind stay as created: teeth already drawn with the condition keep their meaning. */
export const updateConditionSchema = z.strictObject({
  code: conditionCode,
  /** Empty on a built-in condition: back to its usual name. */
  name: optionalText(40),
  color: conditionColor,
})

export const setConditionHiddenSchema = z.strictObject({
  code: conditionCode,
  hidden: z.boolean(),
})

export type CreateConditionInput = z.input<typeof createConditionSchema>
export type UpdateConditionInput = z.input<typeof updateConditionSchema>

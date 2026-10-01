import { z } from "zod"

import { optionalText, text, uuid } from "@/lib/validation"

import { teethField } from "../chart/schemas"
import { SURFACES } from "../chart/teeth"

export const ITEM_STATUSES = ["planned", "in_progress", "done", "cancelled"] as const
export const PLAN_STATUSES = ["proposed", "accepted", "completed", "cancelled"] as const

export const createPlanSchema = z.strictObject({
  patientId: uuid,
  title: text(2, 100),
  notes: optionalText(500),
})

export const addPlanItemsSchema = z.strictObject({
  planId: uuid,
  procedureId: uuid,
  teeth: teethField,
  surfaces: z.array(z.enum(SURFACES)).max(5),
  phase: z.number().int().min(1).max(20),
  notes: optionalText(300),
})

export const setItemStatusSchema = z.strictObject({ itemId: uuid, status: z.enum(ITEM_STATUSES) })

/** "completed" is reached automatically when every item is done. */
export const setPlanStatusSchema = z.strictObject({
  planId: uuid,
  status: z.enum(["proposed", "accepted", "cancelled"]),
})

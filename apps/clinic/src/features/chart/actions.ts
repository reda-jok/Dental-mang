"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  addFindingSchema,
  createConditionSchema,
  resolveFindingSchema,
  setConditionHiddenSchema,
  updateConditionSchema,
} from "./schemas"
import {
  addFindings,
  createCondition,
  resolveFinding,
  setConditionHidden,
  updateCondition,
} from "./service"

export const addFindingAction = defineAction({
  schema: addFindingSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    await addFindings(user, input)
    revalidatePath(`/patients/${input.patientId}/chart`)
    return null
  },
})

export const resolveFindingAction = defineAction({
  schema: resolveFindingSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId } = await resolveFinding(user, input.id)
    revalidatePath(`/patients/${patientId}/chart`)
    return null
  },
})

export const createConditionAction = defineAction({
  schema: createConditionSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    const condition = await createCondition(user, input)
    revalidatePath("/settings/conditions")
    return condition
  },
})

export const updateConditionAction = defineAction({
  schema: updateConditionSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await updateCondition(user, input)
    revalidatePath("/settings/conditions")
    return null
  },
})

export const setConditionHiddenAction = defineAction({
  schema: setConditionHiddenSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await setConditionHidden(user, input)
    revalidatePath("/settings/conditions")
    return null
  },
})

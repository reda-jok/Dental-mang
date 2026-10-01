"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  addPlanItemsSchema,
  createPlanSchema,
  setItemStatusSchema,
  setPlanStatusSchema,
} from "./schemas"
import { addPlanItems, createPlan, setItemStatus, setPlanStatus } from "./service"

const refresh = (patientId: string) => revalidatePath(`/patients/${patientId}`, "layout")

export const createPlanAction = defineAction({
  schema: createPlanSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const plan = await createPlan(user, input)
    refresh(input.patientId)
    return plan
  },
})

export const addPlanItemsAction = defineAction({
  schema: addPlanItemsSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const result = await addPlanItems(user, input)
    refresh(result.patientId)
    return { count: result.count }
  },
})

export const setItemStatusAction = defineAction({
  schema: setItemStatusSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId } = await setItemStatus(user, input)
    refresh(patientId)
    return null
  },
})

export const setPlanStatusAction = defineAction({
  schema: setPlanStatusSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId } = await setPlanStatus(user, input)
    refresh(patientId)
    return null
  },
})

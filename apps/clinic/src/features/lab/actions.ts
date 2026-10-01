"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  archiveLabSchema,
  createLabCaseSchema,
  createLabSchema,
  labCaseStepSchema,
  updateLabCaseSchema,
  updateLabSchema,
} from "./schemas"
import {
  archiveLab,
  createLab,
  createLabCase,
  stepLabCase,
  updateLab,
  updateLabCase,
} from "./service"

const refresh = () => {
  revalidatePath("/lab", "layout")
  revalidatePath("/patients", "layout")
  revalidatePath("/dashboard")
}

export const createLabCaseAction = defineAction({
  schema: createLabCaseSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const created = await createLabCase(user, input)
    refresh()
    return created
  },
})

export const updateLabCaseAction = defineAction({
  schema: updateLabCaseSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await updateLabCase(user, input)
    refresh()
    return null
  },
})

export const stepLabCaseAction = defineAction({
  schema: labCaseStepSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const result = await stepLabCase(user, input)
    refresh()
    return result
  },
})

export const createLabAction = defineAction({
  schema: createLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const lab = await createLab(user, input)
    refresh()
    return lab
  },
})

export const updateLabAction = defineAction({
  schema: updateLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await updateLab(user, input)
    refresh()
    return null
  },
})

export const archiveLabAction = defineAction({
  schema: archiveLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await archiveLab(user, input)
    refresh()
    return null
  },
})

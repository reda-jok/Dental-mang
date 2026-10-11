"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  createClinicalNoteSchema,
  deleteClinicalNoteSchema,
  reviseClinicalNoteSchema,
} from "./schemas"
import { createClinicalNote, deleteClinicalNote, reviseClinicalNote } from "./service"

export const createClinicalNoteAction = defineAction({
  schema: createClinicalNoteSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const note = await createClinicalNote(user, input)
    revalidatePath(`/patients/${input.patientId}/notes`)
    return note
  },
})

export const reviseClinicalNoteAction = defineAction({
  schema: reviseClinicalNoteSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId, version } = await reviseClinicalNote(user, input)
    revalidatePath(`/patients/${patientId}/notes`)
    return { version }
  },
})

export const deleteClinicalNoteAction = defineAction({
  schema: deleteClinicalNoteSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId } = await deleteClinicalNote(user, input)
    revalidatePath(`/patients/${patientId}/notes`)
    return null
  },
})

"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  archivePatientSchema,
  createPatientSchema,
  medicalHistorySchema,
  updatePatientSchema,
} from "./schemas"
import { deleteAttachmentSchema } from "./attachments"
import {
  archivePatient,
  createPatient,
  removeAttachment,
  saveMedicalHistory,
  updatePatient,
} from "./service"

export const createPatientAction = defineAction({
  schema: createPatientSchema,
  permission: "patient:write",
  handler: async (input, { user }) => {
    const result = await createPatient(user, input)
    if (result.status === "created") revalidatePath("/patients")
    return result
  },
})

export const updatePatientAction = defineAction({
  schema: updatePatientSchema,
  permission: "patient:write",
  handler: async (input, { user }) => {
    await updatePatient(user, input)
    revalidatePath("/patients")
    revalidatePath(`/patients/${input.id}`, "layout")
    return null
  },
})

export const archivePatientAction = defineAction({
  schema: archivePatientSchema,
  permission: "patient:delete",
  handler: async (input, { user }) => {
    await archivePatient(user, input.id)
    revalidatePath("/patients")
    return null
  },
})

export const saveMedicalHistoryAction = defineAction({
  schema: medicalHistorySchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    await saveMedicalHistory(user, input)
    revalidatePath(`/patients/${input.patientId}`, "layout")
    return null
  },
})

export const removeAttachmentAction = defineAction({
  schema: deleteAttachmentSchema,
  permission: "clinical:write",
  handler: async (input, { user }) => {
    const { patientId } = await removeAttachment(user, input.id)
    revalidatePath(`/patients/${patientId}/files`)
    return null
  },
})

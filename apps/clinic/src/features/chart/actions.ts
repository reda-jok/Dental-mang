"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { addFindingSchema, resolveFindingSchema } from "./schemas"
import { addFindings, resolveFinding } from "./service"

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

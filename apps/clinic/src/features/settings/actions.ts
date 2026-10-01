"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { clinicSettingsSchema } from "./schemas"
import { updateClinicSettings } from "./service"

export const updateClinicSettingsAction = defineAction({
  schema: clinicSettingsSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await updateClinicSettings(user, input)
    revalidatePath("/", "layout") // clinic name appears in the sidebar
    return null
  },
})

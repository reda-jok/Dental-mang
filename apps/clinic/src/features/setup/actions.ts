"use server"

import { defineAction } from "@/server/action"

import { setupSchema } from "./schemas"
import { completeSetup } from "./service"

export const setupClinic = defineAction({
  schema: setupSchema,
  permission: "public", // only works while no clinic exists (checked in the service)
  handler: async (input) => {
    await completeSetup(input)
    return null
  },
})

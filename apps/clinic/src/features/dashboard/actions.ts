"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { defineAction } from "@/server/action"
import { requireUser } from "@/server/session"

import { saveLayoutSchema, saveRoleLayoutSchema } from "./schemas"
import { resetOwnLayout, saveOwnLayout, saveRoleLayout } from "./service"

// "public" on purpose: every signed-in user arranges their own dashboard, whatever their
// role. The handler still requires a signed-in user and only touches that user's row.
export const saveOwnLayoutAction = defineAction({
  schema: saveLayoutSchema,
  permission: "public",
  handler: async (input) => {
    await saveOwnLayout(await requireUser(), input)
    revalidatePath("/dashboard")
    return null
  },
})

export const resetOwnLayoutAction = defineAction({
  schema: z.strictObject({}),
  permission: "public",
  handler: async () => {
    await resetOwnLayout(await requireUser())
    revalidatePath("/dashboard")
    return null
  },
})

export const saveRoleLayoutAction = defineAction({
  schema: saveRoleLayoutSchema,
  permission: "settings:permissions",
  handler: async (input, { user }) => {
    await saveRoleLayout(user, input)
    revalidatePath("/dashboard")
    return null
  },
})

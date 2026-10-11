"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { logReminderSchema } from "./schemas"
import { logAppointmentReminder } from "./service"

/** Records that an appointment reminder was sent (WhatsApp opens on the user's device). */
export const logReminderAction = defineAction({
  schema: logReminderSchema,
  permission: "appointment:write",
  handler: async (input, { user }) => {
    await logAppointmentReminder(user, input)
    revalidatePath("/appointments/reminders")
    revalidatePath("/dashboard")
    return null
  },
})

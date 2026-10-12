"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { getAvailability, getBookingItems, getFinishOptions } from "./data"
import {
  appointmentIdSchema,
  archiveRoomSchema,
  availabilitySchema,
  bookAppointmentSchema,
  bookingItemsSchema,
  finishVisitSchema,
  restDaySchema,
  roomSchema,
  scheduleSettingsSchema,
  setStatusSchema,
} from "./schemas"
import {
  addRoom,
  archiveRoom,
  bookAppointment,
  finishVisit,
  setAppointmentStatus,
  setRestDay,
  updateScheduleSettings,
} from "./service"

/** Appointments show up on the dashboard, the appointments page and patient pages. */
const refresh = () => revalidatePath("/", "layout")

export const bookAppointmentAction = defineAction({
  schema: bookAppointmentSchema,
  permission: "appointment:write",
  handler: async (input, { user }) => {
    const appointment = await bookAppointment(user, input)
    refresh()
    return appointment
  },
})

export const setAppointmentStatusAction = defineAction({
  schema: setStatusSchema,
  permission: "appointment:write",
  handler: async (input, { user }) => {
    await setAppointmentStatus(user, input)
    refresh()
    return null
  },
})

export const availabilityAction = defineAction({
  schema: availabilitySchema,
  permission: "appointment:read",
  handler: async (input) => getAvailability(input),
})

export const finishVisitAction = defineAction({
  schema: finishVisitSchema,
  permission: "appointment:write",
  handler: async (input, { user }) => {
    await finishVisit(user, input)
    refresh()
    return null
  },
})

/** The patient's unfinished plan treatments, for the booking form. */
export const bookingItemsAction = defineAction({
  schema: bookingItemsSchema,
  permission: "appointment:write",
  handler: async (input) => getBookingItems(input.patientId),
})

/** What the finish dialog lists for a visit. */
export const finishOptionsAction = defineAction({
  schema: appointmentIdSchema,
  permission: "clinical:write",
  handler: async (input) => getFinishOptions(input.id),
})

export const setRestDayAction = defineAction({
  schema: restDaySchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    const result = await setRestDay(user, input)
    refresh()
    return result
  },
})

export const updateScheduleSettingsAction = defineAction({
  schema: scheduleSettingsSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await updateScheduleSettings(user, input)
    refresh()
    return null
  },
})

export const addRoomAction = defineAction({
  schema: roomSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await addRoom(user, input)
    refresh()
    return null
  },
})

export const archiveRoomAction = defineAction({
  schema: archiveRoomSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await archiveRoom(user, input.id)
    refresh()
    return null
  },
})

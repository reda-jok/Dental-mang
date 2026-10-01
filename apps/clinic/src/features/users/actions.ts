"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  createUserSchema,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "./schemas"
import { createStaff, resetStaffPassword, setStaffActive, updateStaff } from "./service"

export const createUserAction = defineAction({
  schema: createUserSchema,
  permission: "user:create",
  handler: async (input, { user }) => {
    const result = await createStaff(user, input)
    revalidatePath("/settings/users")
    return result
  },
})

export const updateUserAction = defineAction({
  schema: updateUserSchema,
  permission: "user:update",
  handler: async (input, { user }) => {
    await updateStaff(user, input)
    revalidatePath("/settings/users")
    return null
  },
})

export const setUserActiveAction = defineAction({
  schema: setUserActiveSchema,
  permission: "user:ban",
  handler: async (input, { user }) => {
    await setStaffActive(user, input)
    revalidatePath("/settings/users")
    return null
  },
})

export const resetPasswordAction = defineAction({
  schema: resetPasswordSchema,
  permission: "user:set-password",
  handler: async (input, { user }) => {
    await resetStaffPassword(user, input)
    return null
  },
})

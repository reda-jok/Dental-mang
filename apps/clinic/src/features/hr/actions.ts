"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { setPaySchema } from "./schemas"
import { setDentistPay } from "./service"

/** The owner sets a dentist's pay type, rate and salary from a month on. */
export const setDentistPayAction = defineAction({
  schema: setPaySchema,
  permission: "hr:pay",
  handler: async (input, { user }) => {
    await setDentistPay(user, input)
    revalidatePath("/hr")
    return null
  },
})

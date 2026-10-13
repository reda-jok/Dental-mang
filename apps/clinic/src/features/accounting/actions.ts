"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { recordExpenseSchema, voidExpenseSchema } from "./schemas"
import { recordExpense, voidExpense } from "./service"

export const recordExpenseAction = defineAction({
  schema: recordExpenseSchema,
  permission: "accounting:expense",
  handler: async (input, { user }) => {
    const expense = await recordExpense(user, input)
    revalidatePath("/accounting")
    revalidatePath("/billing/cash")
    return expense
  },
})

export const voidExpenseAction = defineAction({
  schema: voidExpenseSchema,
  permission: "accounting:expense",
  handler: async (input, { user }) => {
    const result = await voidExpense(user, input)
    revalidatePath("/accounting")
    revalidatePath("/billing/cash")
    return result
  },
})

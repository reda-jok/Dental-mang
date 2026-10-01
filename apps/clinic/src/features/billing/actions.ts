"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { createInvoiceSchema, voidInvoiceSchema } from "./schemas"
import { createInvoice, voidInvoice } from "./service"

export const createInvoiceAction = defineAction({
  schema: createInvoiceSchema,
  permission: "billing:write",
  handler: async (input, { user }) => {
    const invoice = await createInvoice(user, input)
    revalidatePath(`/patients/${input.patientId}`, "layout")
    revalidatePath("/billing", "layout")
    return invoice
  },
})

/** `billing:void` is adjustable: the owner decides which roles have it. */
export const voidInvoiceAction = defineAction({
  schema: voidInvoiceSchema,
  permission: "billing:void",
  handler: async (input, { user }) => {
    const result = await voidInvoice(user, input)
    revalidatePath("/billing", "layout")
    revalidatePath("/patients", "layout")
    return result
  },
})

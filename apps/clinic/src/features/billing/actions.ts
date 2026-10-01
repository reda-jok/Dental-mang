"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import {
  createInvoiceSchema,
  paymentReminderSchema,
  recordPaymentSchema,
  refundSchema,
  voidInvoiceSchema,
  voidPaymentSchema,
} from "./schemas"
import {
  createInvoice,
  logPaymentReminder,
  recordPayment,
  refundPatient,
  voidInvoice,
  voidPayment,
} from "./service"

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

export const recordPaymentAction = defineAction({
  schema: recordPaymentSchema,
  permission: "billing:write",
  handler: async (input, { user }) => {
    const payment = await recordPayment(user, input)
    revalidatePath("/billing", "layout")
    revalidatePath(`/patients/${input.patientId}`, "layout")
    return payment
  },
})

/** Uses the void permission: a payment entered by mistake is voided like an invoice. */
export const voidPaymentAction = defineAction({
  schema: voidPaymentSchema,
  permission: "billing:void",
  handler: async (input, { user }) => {
    const result = await voidPayment(user, input)
    revalidatePath("/billing", "layout")
    revalidatePath("/patients", "layout")
    return result
  },
})

/** `billing:refund` is adjustable: the owner decides which roles may give money back. */
export const refundAction = defineAction({
  schema: refundSchema,
  permission: "billing:refund",
  handler: async (input, { user }) => {
    const refund = await refundPatient(user, input)
    revalidatePath("/billing", "layout")
    revalidatePath(`/patients/${input.patientId}`, "layout")
    return refund
  },
})

/** Records that a payment reminder was sent (WhatsApp opens on the user's device). */
export const logPaymentReminderAction = defineAction({
  schema: paymentReminderSchema,
  permission: "billing:write",
  handler: async (input, { user }) => {
    await logPaymentReminder(user, input)
    revalidatePath("/billing/debts")
    revalidatePath(`/patients/${input.patientId}/billing`)
    return null
  },
})

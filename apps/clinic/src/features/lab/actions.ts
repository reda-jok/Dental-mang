"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"
import { AppError } from "@/server/errors"
import { can } from "@/server/permissions"

import {
  archiveLabSchema,
  createLabCaseSchema,
  createLabSchema,
  labAdjustmentSchema,
  labCaseStepSchema,
  labPaymentSchema,
  updateLabCaseSchema,
  updateLabSchema,
  voidLabPaymentSchema,
} from "./schemas"
import {
  addLabAdjustment,
  archiveLab,
  createLab,
  createLabCase,
  recordLabPayment,
  stepLabCase,
  updateLab,
  updateLabCase,
  voidLabPayment,
} from "./service"

const refresh = () => {
  revalidatePath("/lab", "layout")
  revalidatePath("/patients", "layout")
  revalidatePath("/dashboard")
}

export const createLabCaseAction = defineAction({
  schema: createLabCaseSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const created = await createLabCase(user, input)
    refresh()
    return created
  },
})

export const updateLabCaseAction = defineAction({
  schema: updateLabCaseSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await updateLabCase(user, input)
    refresh()
    return null
  },
})

export const stepLabCaseAction = defineAction({
  schema: labCaseStepSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const result = await stepLabCase(user, input)
    refresh()
    return result
  },
})

export const createLabAction = defineAction({
  schema: createLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    const lab = await createLab(user, input)
    refresh()
    return lab
  },
})

export const updateLabAction = defineAction({
  schema: updateLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await updateLab(user, input)
    refresh()
    return null
  },
})

export const archiveLabAction = defineAction({
  schema: archiveLabSchema,
  permission: "lab:write",
  handler: async (input, { user }) => {
    await archiveLab(user, input)
    refresh()
    return null
  },
})

/** Money changes the lab accounts and the cash drawer. */
const refreshMoney = () => {
  revalidatePath("/lab", "layout")
  revalidatePath("/billing/cash")
}

/** `lab:pay` is adjustable: the owner decides which roles may pay labs. */
export const recordLabPaymentAction = defineAction({
  schema: labPaymentSchema,
  permission: "lab:pay",
  handler: async (input, { user }) => {
    const result = await recordLabPayment(user, input)
    refreshMoney()
    return result
  },
})

/** Voiding money is the same permission as voiding a patient's payment. */
export const voidLabPaymentAction = defineAction({
  schema: voidLabPaymentSchema,
  permission: "billing:void",
  handler: async (input, { user }) => {
    if (!(await can(user, "lab:pay"))) throw new AppError("forbidden")
    const result = await voidLabPayment(user, input)
    refreshMoney()
    return result
  },
})

export const addLabAdjustmentAction = defineAction({
  schema: labAdjustmentSchema,
  permission: "lab:pay",
  handler: async (input, { user }) => {
    const result = await addLabAdjustment(user, input)
    refreshMoney()
    return result
  },
})

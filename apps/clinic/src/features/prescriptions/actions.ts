"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { defineAction } from "@/server/action"

import {
  archiveMedicationSchema,
  createMedicationSchema,
  createPrescriptionSchema,
  updateMedicationSchema,
} from "./schemas"
import {
  archiveMedication,
  createMedication,
  createPrescription,
  loadStarterMedications,
  updateMedication,
} from "./service"

export const createPrescriptionAction = defineAction({
  schema: createPrescriptionSchema,
  permission: "clinical:prescribe",
  handler: async (input, { user }) => {
    const prescription = await createPrescription(user, input)
    revalidatePath(`/patients/${input.patientId}/prescriptions`)
    return prescription
  },
})

export const createMedicationAction = defineAction({
  schema: createMedicationSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    const medication = await createMedication(user, input)
    revalidatePath("/settings/medications")
    return medication
  },
})

export const updateMedicationAction = defineAction({
  schema: updateMedicationSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await updateMedication(user, input)
    revalidatePath("/settings/medications")
    return null
  },
})

export const archiveMedicationAction = defineAction({
  schema: archiveMedicationSchema,
  permission: "settings:write",
  handler: async (input, { user }) => {
    await archiveMedication(user, input)
    revalidatePath("/settings/medications")
    return null
  },
})

export const loadStarterMedicationsAction = defineAction({
  schema: z.strictObject({}),
  permission: "settings:write",
  handler: async (_input, { user }) => {
    await loadStarterMedications(user)
    revalidatePath("/settings/medications")
    return null
  },
})

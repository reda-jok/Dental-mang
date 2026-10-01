import { z } from "zod"

import { optionalMultiline, optionalText, text, uuid } from "@/lib/validation"

export const MEDICATION_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "mouthwash",
  "gel",
  "ointment",
  "drops",
  "injection",
  "other",
] as const

/** Allergy codes a medicine can belong to (see ALLERGIES in patients/medical.ts). */
export const MEDICATION_GROUPS = [
  "penicillin",
  "nsaids",
  "chlorhexidine",
  "local_anesthetic",
] as const

const medicationFields = {
  name: text(2, 80),
  form: z.enum(MEDICATION_FORMS),
  dose: optionalText(80),
  frequency: optionalText(80),
  duration: optionalText(40),
  group: z
    .union([z.enum(MEDICATION_GROUPS), z.literal("")])
    .optional()
    .transform((v) => v || null),
}

export const createMedicationSchema = z.strictObject(medicationFields)
export const updateMedicationSchema = z.strictObject({ ...medicationFields, id: uuid })
export const archiveMedicationSchema = z.strictObject({ id: uuid })

export const prescriptionItemSchema = z.strictObject({
  /** From the medicines list; empty for a medicine written in by hand. */
  medicationId: z.union([uuid, z.literal("")]).optional(),
  name: text(2, 80),
  dose: optionalText(80),
  frequency: optionalText(80),
  duration: optionalText(40),
  notes: optionalText(120),
})

export const createPrescriptionSchema = z.strictObject({
  patientId: uuid,
  items: z.array(prescriptionItemSchema).min(1, "noMedicines").max(15),
  notes: optionalMultiline(300),
  /** Allergy codes whose warning the dentist confirmed. */
  acknowledged: z.array(z.string().max(40)).max(10),
})

export type MedicationInput = z.input<typeof createMedicationSchema>
export type CreatePrescriptionInput = z.input<typeof createPrescriptionSchema>

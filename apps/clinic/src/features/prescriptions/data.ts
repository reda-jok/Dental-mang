import "server-only"

import { toIsoDate } from "@/lib/dates"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

const medicationSelect = {
  id: true,
  name: true,
  form: true,
  dose: true,
  frequency: true,
  duration: true,
  group: true,
  archivedAt: true,
} as const

/** The medicines list for Settings (archived ones last). */
export async function getMedicationsForSettings() {
  await authorize("settings:read")
  return db.medication.findMany({
    orderBy: [
      { archivedAt: { sort: "asc", nulls: "first" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: medicationSelect,
  })
}

export type MedicationRow = Awaited<ReturnType<typeof getMedicationsForSettings>>[number]

/** What the prescription form needs: the medicines list and what's on record for the patient. */
export async function getPrescriptionFormData(patientId: string) {
  await authorize("clinical:prescribe")
  const [catalog, history] = await Promise.all([
    db.medication.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: medicationSelect,
    }),
    db.medicalHistory.findFirst({
      where: { patientId },
      orderBy: { version: "desc" },
      select: {
        allergies: true,
        otherAllergies: true,
        conditions: true,
        pregnant: true,
        medications: true,
      },
    }),
  ])
  return { catalog, history }
}

export type PrescriptionFormData = Awaited<ReturnType<typeof getPrescriptionFormData>>

const prescriptionSelect = {
  id: true,
  issuedOn: true,
  notes: true,
  acknowledged: true,
  createdAt: true,
  prescribedBy: { select: { name: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      form: true,
      dose: true,
      frequency: true,
      duration: true,
      notes: true,
    },
  },
} as const

export async function listPrescriptions(patientId: string) {
  await authorize("clinical:read")
  const rows = await db.prescription.findMany({
    where: { patientId, deletedAt: null, patient: { deletedAt: null } },
    orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
    select: prescriptionSelect,
  })
  return rows.map(({ prescribedBy, issuedOn, ...p }) => ({
    ...p,
    issuedOn: toIsoDate(issuedOn),
    prescribedByName: prescribedBy?.name ?? null,
  }))
}

export type PrescriptionView = Awaited<ReturnType<typeof listPrescriptions>>[number]

/** One prescription with the patient's details, for printing. */
export async function getPrescriptionForPrint(id: string) {
  await authorize("clinical:read")
  const row = await db.prescription.findFirst({
    where: { id, deletedAt: null, patient: { deletedAt: null } },
    select: {
      ...prescriptionSelect,
      patient: { select: { fullName: true, code: true, gender: true, birthDate: true } },
    },
  })
  if (!row) return null
  const { prescribedBy, issuedOn, patient, ...p } = row
  return {
    ...p,
    issuedOn: toIsoDate(issuedOn),
    prescribedByName: prescribedBy?.name ?? null,
    patient: { ...patient, birthDate: patient.birthDate ? toIsoDate(patient.birthDate) : null },
  }
}

export type PrescriptionPrint = NonNullable<Awaited<ReturnType<typeof getPrescriptionForPrint>>>

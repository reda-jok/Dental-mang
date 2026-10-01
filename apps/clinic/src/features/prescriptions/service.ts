import "server-only"

import type { z } from "zod"

import { todayIso } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { needsConfirmation, prescriptionWarnings } from "./rules"
import type {
  archiveMedicationSchema,
  createMedicationSchema,
  createPrescriptionSchema,
  updateMedicationSchema,
} from "./schemas"
import { STARTER_MEDICATIONS } from "./starter"

/**
 * Saves a prescription. Allergy conflicts from the latest medical history must have
 * been confirmed by the dentist (the form shows them; the server checks again).
 */
export async function createPrescription(
  actor: CurrentUser,
  input: z.output<typeof createPrescriptionSchema>,
  day?: string,
) {
  return db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")

    const ids = [...new Set(input.items.flatMap((i) => (i.medicationId ? [i.medicationId] : [])))]
    const catalog = await tx.medication.findMany({
      where: { id: { in: ids }, archivedAt: null },
      select: { id: true, form: true, group: true },
    })
    if (catalog.length !== ids.length) throw new AppError("validation", "medicationMissing")
    const byId = new Map(catalog.map((m) => [m.id, m]))

    const history = await tx.medicalHistory.findFirst({
      where: { patientId: patient.id },
      orderBy: { version: "desc" },
      select: { allergies: true, conditions: true, pregnant: true },
    })
    const warnings = prescriptionWarnings(
      history,
      input.items.map((i) => ({
        name: i.name,
        group: i.medicationId ? (byId.get(i.medicationId)?.group ?? null) : null,
      })),
    )
    const unconfirmed = needsConfirmation(warnings).filter((c) => !input.acknowledged.includes(c))
    if (unconfirmed.length) throw new AppError("validation", "allergyNotConfirmed")

    const settings = await tx.clinicSettings.findUnique({
      where: { id: 1 },
      select: { timezone: true },
    })
    const issuedOn = day ?? todayIso(settings?.timezone)
    const prescription = await tx.prescription.create({
      data: {
        patientId: patient.id,
        prescribedById: actor.id,
        issuedOn: new Date(`${issuedOn}T00:00:00Z`),
        notes: input.notes,
        acknowledged: needsConfirmation(warnings),
        items: {
          create: input.items.map((item, index) => ({
            sortOrder: index,
            medicationId: item.medicationId || null,
            name: item.name,
            form: item.medicationId ? byId.get(item.medicationId)!.form : null,
            dose: item.dose,
            frequency: item.frequency,
            duration: item.duration,
            notes: item.notes,
          })),
        },
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "prescription",
      entityId: prescription.id,
      after: {
        patientId: patient.id,
        medicines: input.items.map((i) => i.name),
        acknowledged: needsConfirmation(warnings),
      },
    })
    return prescription
  })
}

export async function createMedication(
  actor: CurrentUser,
  input: z.output<typeof createMedicationSchema>,
) {
  return db.$transaction(async (tx) => {
    const last = await tx.medication.aggregate({ _max: { sortOrder: true } })
    const medication = await tx.medication.create({
      data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "medication",
      entityId: medication.id,
      after: input,
    })
    return medication
  })
}

export async function updateMedication(
  actor: CurrentUser,
  { id, ...input }: z.output<typeof updateMedicationSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.medication.findUnique({ where: { id } })
    if (!before) throw new AppError("not_found")
    await tx.medication.update({ where: { id }, data: input })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "medication",
      entityId: id,
      before,
      after: input,
    })
  })
}

/** Hides a medicine from new prescriptions; old prescriptions keep it. */
export async function archiveMedication(
  actor: CurrentUser,
  { id }: z.output<typeof archiveMedicationSchema>,
) {
  await db.$transaction(async (tx) => {
    const archived = await tx.medication.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    })
    if (archived.count === 0) throw new AppError("not_found")
    await recordAudit(tx, {
      userId: actor.id,
      action: "delete",
      entity: "medication",
      entityId: id,
    })
  })
}

/** Fills an empty medicines list with the starter list. */
export async function loadStarterMedications(actor: CurrentUser) {
  await db.$transaction(async (tx) => {
    if ((await tx.medication.count()) > 0) throw new AppError("conflict", "catalogNotEmpty")
    await tx.medication.createMany({
      data: STARTER_MEDICATIONS.map((m, index) => ({
        ...m,
        duration: m.duration || null,
        group: m.group ?? null,
        sortOrder: index,
      })),
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "medication_catalog",
      after: { starter: true, count: STARTER_MEDICATIONS.length },
    })
  })
}

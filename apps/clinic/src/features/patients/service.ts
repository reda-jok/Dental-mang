import "server-only"

import type { z } from "zod"

import { normalizeArabic } from "@/lib/arabic"
import { ageInYears, birthDateFromAge, parseIsoDate, todayIso, toIsoDate } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { CreatePatientOutput, medicalHistorySchema, UpdatePatientOutput } from "./schemas"
import { buildSearchText } from "./search"

type PatientInput = CreatePatientOutput | UpdatePatientOutput

/** Birth mode → the two stored columns. */
function birthColumns(input: PatientInput) {
  switch (input.birthMode) {
    case "date":
      return { birthDate: parseIsoDate(input.birthDate), birthDateEstimated: false }
    case "age":
      return {
        birthDate: parseIsoDate(birthDateFromAge(input.age, todayIso(env.CLINIC_TIMEZONE))),
        birthDateEstimated: true,
      }
  }
}

function patientColumns(input: PatientInput) {
  return {
    fullName: input.fullName,
    gender: input.gender,
    phone: input.phone,
    phone2: input.phone2,
    address: input.address,
    referralSource: input.referralSource,
    notes: input.notes,
    ...birthColumns(input),
  }
}

type MedicalAnswer = CreatePatientOutput["medical"]

/** Normalized medical-history columns (deduplicated codes; pregnancy only for women). */
function medicalColumns(m: MedicalAnswer, gender: "male" | "female") {
  return {
    ...m,
    pregnant: gender === "female" && m.pregnant,
    conditions: [...new Set(m.conditions)],
    allergies: [...new Set(m.allergies)],
  }
}

export type DuplicateMatch = { id: string; code: string; fullName: string; phone: string | null }

/** Same normalized name, or a shared phone number. */
async function findDuplicates(tx: Db, input: PatientInput, excludeId?: string) {
  const phones = [input.phone, input.phone2].filter((p): p is string => !!p)
  const candidates = await tx.patient.findMany({
    where: {
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
      OR: [
        { searchText: { startsWith: normalizeArabic(input.fullName) } },
        ...(phones.length ? [{ phone: { in: phones } }, { phone2: { in: phones } }] : []),
      ],
    },
    select: { id: true, code: true, fullName: true, phone: true, phone2: true },
    take: 10,
  })
  const name = normalizeArabic(input.fullName)
  return candidates
    .filter(
      (c) =>
        normalizeArabic(c.fullName) === name || phones.some((p) => p === c.phone || p === c.phone2),
    )
    .map(({ id, code, fullName, phone }) => ({ id, code, fullName, phone }))
}

export async function createPatient(
  actor: CurrentUser,
  input: CreatePatientOutput,
): Promise<
  { status: "created"; id: string } | { status: "duplicates"; matches: DuplicateMatch[] }
> {
  if (!input.confirmDuplicate) {
    const matches = await findDuplicates(db, input)
    if (matches.length) return { status: "duplicates", matches }
  }

  const id = await db.$transaction(async (tx) => {
    const columns = patientColumns(input)
    const created = await tx.patient.create({
      data: { ...columns, searchText: buildSearchText(columns), createdById: actor.id },
      select: { id: true, code: true },
    })
    // The code comes from a DB sequence, so it's only known after the insert.
    await tx.patient.update({
      where: { id: created.id },
      data: { searchText: buildSearchText({ ...columns, code: created.code }) },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "patient",
      entityId: created.id,
      after: { code: created.code, ...columns },
    })

    // The intake questionnaire becomes medical-history version 1, in the same transaction:
    // a patient never exists without an answered medical history.
    const medical = medicalColumns(input.medical, input.gender)
    await tx.medicalHistory.create({
      data: { ...medical, patientId: created.id, version: 1, recordedById: actor.id },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "medical_history",
      entityId: created.id,
      after: { version: 1, ...medical },
    })
    return created.id
  })
  return { status: "created", id }
}

export async function updatePatient(actor: CurrentUser, input: UpdatePatientOutput) {
  await db.$transaction(async (tx) => {
    const before = await tx.patient.findFirst({
      where: { id: input.id, deletedAt: null },
      select: {
        code: true,
        fullName: true,
        gender: true,
        birthDate: true,
        birthDateEstimated: true,
        phone: true,
        phone2: true,
        address: true,
        referralSource: true,
        notes: true,
      },
    })
    if (!before) throw new AppError("not_found")

    const columns = patientColumns(input)
    // Re-saving an unchanged age must not move the estimated birth date to today's date.
    if (
      input.birthMode === "age" &&
      before.birthDateEstimated &&
      before.birthDate &&
      ageInYears(toIsoDate(before.birthDate), todayIso(env.CLINIC_TIMEZONE)) === input.age
    ) {
      columns.birthDate = before.birthDate
    }
    await tx.patient.update({
      where: { id: input.id },
      data: { ...columns, searchText: buildSearchText({ ...columns, code: before.code }) },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "patient",
      entityId: input.id,
      before,
      after: columns,
    })
  })
}

/** Soft delete: hidden from lists, kept for records and audits. */
export async function archivePatient(actor: CurrentUser, id: string) {
  await db.$transaction(async (tx) => {
    const updated = await tx.patient.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (updated.count === 0) throw new AppError("not_found")
    await recordAudit(tx, { userId: actor.id, action: "delete", entity: "patient", entityId: id })
  })
}

/** Appends a new version; fails if someone else saved since the form was opened. */
export async function saveMedicalHistory(
  actor: CurrentUser,
  input: z.output<typeof medicalHistorySchema>,
) {
  const { patientId, baseVersion, ...fields } = input
  await db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { gender: true },
    })
    if (!patient) throw new AppError("not_found")

    const latest = await tx.medicalHistory.findFirst({
      where: { patientId },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const current = latest?.version ?? 0
    if (current !== baseVersion) throw new AppError("conflict", "medicalHistoryChanged")

    const data = medicalColumns(fields, patient.gender)
    // @@unique([patientId, version]) also stops two simultaneous saves.
    await tx.medicalHistory.create({
      data: { ...data, patientId, version: current + 1, recordedById: actor.id },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "medical_history",
      entityId: patientId,
      after: { version: current + 1, ...data },
    })
  })
}

/** Soft delete: hidden from the patient's files, kept on disk for records. */
export async function removeAttachment(actor: CurrentUser, id: string) {
  const patientId = await db.$transaction(async (tx) => {
    const attachment = await tx.attachment.findFirst({
      where: { id, deletedAt: null },
      select: { patientId: true },
    })
    if (!attachment) throw new AppError("not_found")
    await tx.attachment.update({ where: { id }, data: { deletedAt: new Date() } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "delete",
      entity: "attachment",
      entityId: id,
    })
    return attachment.patientId
  })
  return { patientId }
}

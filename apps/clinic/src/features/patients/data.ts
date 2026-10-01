import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { searchTokens } from "@/lib/arabic"
import { toIsoDate } from "@/lib/dates"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export const PAGE_SIZE = 20

const notDeleted = { deletedAt: null } satisfies Prisma.PatientWhereInput

function searchWhere(query: string): Prisma.PatientWhereInput {
  const tokens = searchTokens(query)
  // Each token must appear in the normalized search text (uses the trigram index).
  return { ...notDeleted, AND: tokens.map((t) => ({ searchText: { contains: t } })) }
}

export async function searchPatients({ q, page }: { q: string; page: number }) {
  await authorize("patient:read")
  const where = searchWhere(q)

  const [total, rows] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        fullName: true,
        gender: true,
        birthDate: true,
        birthDateEstimated: true,
        phone: true,
        createdAt: true,
      },
    }),
  ])

  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, birthDate: r.birthDate ? toIsoDate(r.birthDate) : null })),
  }
}

export type PatientListRow = Awaited<ReturnType<typeof searchPatients>>["rows"][number]

export async function getPatient(id: string) {
  await authorize("patient:read")
  const patient = await db.patient.findFirst({
    where: { id, ...notDeleted },
    select: {
      id: true,
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
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })
  if (!patient) return null
  return {
    ...patient,
    birthDate: patient.birthDate ? toIsoDate(patient.birthDate) : null,
    createdByName: patient.createdBy?.name ?? null,
  }
}

export type PatientDetails = NonNullable<Awaited<ReturnType<typeof getPatient>>>

/** Latest medical-history version (or null if never recorded). */
export async function getMedicalHistory(patientId: string) {
  await authorize("clinical:read")
  const latest = await db.medicalHistory.findFirst({
    where: { patientId, patient: notDeleted },
    orderBy: { version: "desc" },
    select: {
      version: true,
      noneDeclared: true,
      conditions: true,
      otherConditions: true,
      allergies: true,
      otherAllergies: true,
      medications: true,
      pregnant: true,
      smoker: true,
      notes: true,
      createdAt: true,
      recordedBy: { select: { name: true } },
    },
  })
  if (!latest) return null
  const { recordedBy, ...rest } = latest
  return { ...rest, recordedByName: recordedBy?.name ?? null }
}

export type MedicalHistoryView = NonNullable<Awaited<ReturnType<typeof getMedicalHistory>>>

export async function listAttachments(patientId: string) {
  await authorize("clinical:read")
  const rows = await db.attachment.findMany({
    where: { patientId, deletedAt: null, patient: notDeleted },
    orderBy: [{ takenAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      kind: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      takenAt: true,
      notes: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  })
  return rows.map(({ uploadedBy, takenAt, ...r }) => ({
    ...r,
    takenAt: takenAt ? toIsoDate(takenAt) : null,
    uploadedByName: uploadedBy?.name ?? null,
  }))
}

export type AttachmentRow = Awaited<ReturnType<typeof listAttachments>>[number]

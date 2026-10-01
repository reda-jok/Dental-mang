import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { searchTokens } from "@/lib/arabic"
import { todayIso, toIsoDate } from "@/lib/dates"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

import { getClinicSettings } from "../settings/data"
import { dueState, type LabStatus } from "./rules"
import type { LAB_FILTERS } from "./schemas"

async function clinicToday() {
  return todayIso((await getClinicSettings())?.timezone)
}
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

const caseSelect = {
  id: true,
  number: true,
  work: true,
  teeth: true,
  shade: true,
  material: true,
  instructions: true,
  cost: true,
  status: true,
  sentOn: true,
  dueOn: true,
  receivedOn: true,
  fittedOn: true,
  remakes: true,
  cancelReason: true,
  planItemId: true,
  labId: true,
  dentistId: true,
  patient: { select: { id: true, fullName: true, code: true } },
  lab: { select: { name: true } },
  dentist: { select: { name: true } },
} satisfies Prisma.LabCaseSelect

type CaseRow = Prisma.LabCaseGetPayload<{ select: typeof caseSelect }>

function toView(row: CaseRow, today: string) {
  const dueOn = toIsoDate(row.dueOn)
  return {
    ...row,
    cost: row.cost.toString(),
    sentOn: toIsoDate(row.sentOn),
    dueOn,
    receivedOn: row.receivedOn ? toIsoDate(row.receivedOn) : null,
    fittedOn: row.fittedOn ? toIsoDate(row.fittedOn) : null,
    labName: row.lab.name,
    dentistName: row.dentist?.name ?? null,
    due: dueState(row.status as LabStatus, dueOn, today),
  }
}

export type LabCaseView = ReturnType<typeof toView>

export async function listLabCases({
  q,
  status,
}: {
  q: string
  status: (typeof LAB_FILTERS)[number]
}) {
  await authorize("lab:read")
  const today = await clinicToday()
  const tokens = searchTokens(q)
  const where: Prisma.LabCaseWhereInput = {
    patient: { deletedAt: null },
    ...(status === "open" && { status: { in: ["sent", "received"] } }),
    ...(status === "late" && { status: "sent", dueOn: { lt: asDate(today) } }),
    ...(status === "received" && { status: "received" }),
    ...(status === "fitted" && { status: "fitted" }),
    AND: tokens.map((token) => ({
      OR: [
        { number: { contains: token, mode: "insensitive" } },
        { patient: { searchText: { contains: token } } },
        { lab: { name: { contains: token, mode: "insensitive" } } },
      ],
    })),
  }
  const rows = await db.labCase.findMany({
    where,
    // Open work by due date (most urgent first); finished work newest first.
    orderBy: status === "fitted" || status === "all" ? [{ updatedAt: "desc" }] : [{ dueOn: "asc" }],
    take: 200,
    select: caseSelect,
  })
  return { today, rows: rows.map((r) => toView(r, today)) }
}

export async function listPatientLabCases(patientId: string) {
  await authorize("lab:read")
  const today = await clinicToday()
  const rows = await db.labCase.findMany({
    where: { patientId },
    orderBy: { sentOn: "desc" },
    select: caseSelect,
  })
  return rows.map((r) => toView(r, today))
}

/** The numbers above the lab page, and the late / due-today cases for the dashboard. */
export async function getLabSummary() {
  await authorize("lab:read")
  const today = await clinicToday()
  const monthStart = asDate(`${today.slice(0, 7)}-01`)
  const alive = { patient: { deletedAt: null } }
  const [atLab, late, waiting, fitted, urgent] = await Promise.all([
    db.labCase.count({ where: { ...alive, status: "sent" } }),
    db.labCase.count({ where: { ...alive, status: "sent", dueOn: { lt: asDate(today) } } }),
    db.labCase.count({ where: { ...alive, status: "received" } }),
    db.labCase.count({ where: { ...alive, status: "fitted", fittedOn: { gte: monthStart } } }),
    db.labCase.findMany({
      where: { ...alive, status: "sent", dueOn: { lte: asDate(today) } },
      orderBy: { dueOn: "asc" },
      take: 6,
      select: caseSelect,
    }),
  ])
  return { atLab, late, waiting, fitted, urgent: urgent.map((r) => toView(r, today)) }
}

export async function getLabs() {
  await authorize("lab:read")
  const labs = await db.lab.findMany({
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      contactName: true,
      turnaroundDays: true,
      notes: true,
      archivedAt: true,
      _count: { select: { cases: { where: { status: { in: ["sent", "received"] } } } } },
    },
  })
  return labs.map(({ _count, ...lab }) => ({ ...lab, openCases: _count.cases }))
}

export type LabRow = Awaited<ReturnType<typeof getLabs>>[number]

/** Labs and dentists to choose from in the case form. */
export async function getLabFormOptions() {
  await authorize("lab:write")
  const [labs, dentists, settings] = await Promise.all([
    db.lab.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, turnaroundDays: true },
    }),
    db.user.findMany({
      where: { role: { in: ["dentist", "owner"] }, banned: { not: true } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getClinicSettings(),
  ])
  return { today: todayIso(settings?.timezone), labs, dentists }
}

export type LabFormOptions = Awaited<ReturnType<typeof getLabFormOptions>>

/** The patient's treatments that need a lab and have no open case yet. */
export async function getLabPlanItems(patientId: string) {
  await authorize("lab:write")
  const items = await db.treatmentPlanItem.findMany({
    where: {
      plan: { patientId, status: { not: "cancelled" } },
      status: { not: "cancelled" },
      procedure: { requiresLab: true },
      labCases: { none: { status: { in: ["sent", "received"] } } },
    },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, tooth: true, dentistId: true, procedure: { select: { name: true } } },
  })
  return items.map(({ procedure, ...item }) => ({ ...item, work: procedure.name }))
}

export type LabPlanItem = Awaited<ReturnType<typeof getLabPlanItems>>[number]

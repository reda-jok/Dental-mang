import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { searchTokens } from "@/lib/arabic"
import { todayIso, toIsoDate } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

import { getClinicSettings } from "../settings/data"
import { labStatement, monthRange, owedFrom, type LabEntry } from "./money"
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
  billedOn: true,
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
    billedOn: row.billedOn ? toIsoDate(row.billedOn) : null,
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

// ─── Lab money (needs lab:pay) ───────────────────────────────────────────────

const money = (value: { toString(): string } | null | undefined) => value?.toString() ?? "0"

/** Every lab's bills, extra charges, payments and discounts in a date range, summed. */
async function labSums(range: { from?: string; before?: string }) {
  const on = {
    ...(range.from && { gte: asDate(range.from) }),
    ...(range.before && { lt: asDate(range.before) }),
  }
  const [bills, payments, adjustments] = await Promise.all([
    db.labCase.groupBy({
      by: ["labId"],
      where: { billedOn: { not: null, ...on } },
      _sum: { cost: true },
    }),
    db.labPayment.groupBy({
      by: ["labId"],
      where: { voidedAt: null, paidOn: on },
      _sum: { amount: true },
    }),
    db.labAdjustment.groupBy({
      by: ["labId", "kind"],
      where: { madeOn: on },
      _sum: { amount: true },
    }),
  ])
  return (labId: string) => ({
    billed: money(bills.find((b) => b.labId === labId)?._sum.cost),
    paid: money(payments.find((p) => p.labId === labId)?._sum.amount),
    charged: money(adjustments.find((a) => a.labId === labId && a.kind === "charge")?._sum.amount),
    discounted: money(
      adjustments.find((a) => a.labId === labId && a.kind === "discount")?._sum.amount,
    ),
  })
}

/** What the clinic owes each lab now, and this month's bills and payments. */
export async function getLabAccounts() {
  await authorize("lab:pay")
  const today = await clinicToday()
  const month = today.slice(0, 7)
  const [labs, allTime, thisMonth, lastPaid] = await Promise.all([
    db.lab.findMany({
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      select: { id: true, name: true, archivedAt: true },
    }),
    labSums({}),
    labSums({ from: monthRange(month).start }),
    db.labPayment.groupBy({ by: ["labId"], where: { voidedAt: null }, _max: { paidOn: true } }),
  ])
  const rows = labs.map((lab) => {
    const month = thisMonth(lab.id)
    const last = lastPaid.find((p) => p.labId === lab.id)?._max.paidOn
    return {
      ...lab,
      owed: owedFrom(allTime(lab.id)),
      billedThisMonth: month.billed,
      paidThisMonth: month.paid,
      lastPaidOn: last ? toIsoDate(last) : null,
    }
  })
  // Archived labs only matter while something is still owed either way.
  const visible = rows.filter((r) => !r.archivedAt || r.owed !== "0")
  const sum = (pick: (r: (typeof visible)[number]) => string) =>
    fromMinor(visible.reduce((total, r) => total + toMinor(pick(r)), 0n))
  return {
    today,
    month,
    rows: visible,
    totals: {
      owed: sum((r) => r.owed),
      billedThisMonth: sum((r) => r.billedThisMonth),
      paidThisMonth: sum((r) => r.paidThisMonth),
    },
  }
}

export type LabAccounts = Awaited<ReturnType<typeof getLabAccounts>>

const ENTRY_ORDER = { bill: 0, charge: 1, discount: 2, payment: 3 } as const

/**
 * A lab's account for one month ("YYYY-MM", default this month): the balance brought
 * forward, every bill, payment and adjustment with the balance after it, and the totals.
 */
export async function getLabStatement(labId: string, requestedMonth: string) {
  await authorize("lab:pay")
  const today = await clinicToday()
  const month = requestedMonth || today.slice(0, 7)
  const range = monthRange(month)
  const on = { gte: asDate(range.start), lt: asDate(range.end) }
  const [lab, before, cases, payments, adjustments] = await Promise.all([
    db.lab.findUnique({
      where: { id: labId },
      select: { id: true, name: true, phone: true, contactName: true, archivedAt: true },
    }),
    labSums({ before: range.start }),
    db.labCase.findMany({
      where: { labId, billedOn: on },
      orderBy: [{ billedOn: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        work: true,
        teeth: true,
        cost: true,
        billedOn: true,
        status: true,
        patient: { select: { id: true, fullName: true } },
      },
    }),
    db.labPayment.findMany({
      where: { labId, paidOn: on },
      orderBy: [{ paidOn: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        method: true,
        reference: true,
        amount: true,
        paidOn: true,
        notes: true,
        voidedAt: true,
        voidReason: true,
        paidBy: { select: { name: true } },
      },
    }),
    db.labAdjustment.findMany({
      where: { labId, madeOn: on },
      orderBy: [{ madeOn: "asc" }, { createdAt: "asc" }],
      select: { id: true, kind: true, amount: true, madeOn: true, reason: true },
    }),
  ])
  if (!lab) return null

  type Row = LabEntry & {
    id: string
    number: string | null
    /** Bills: the patient, work and teeth. Payments: method and reference. Adjustments: why. */
    patient?: { id: string; fullName: string }
    work?: string
    teeth?: number[]
    method?: "cash" | "card" | "wallet"
    reference?: string | null
    reason?: string | null
    paidByName?: string | null
  }
  const entries: Row[] = [
    ...cases.map((c) => ({
      kind: "bill" as const,
      id: c.id,
      number: c.number,
      date: toIsoDate(c.billedOn!),
      amount: c.cost.toString(),
      patient: c.patient,
      work: c.work,
      teeth: c.teeth,
    })),
    ...adjustments.map((a) => ({
      kind: a.kind,
      id: a.id,
      number: null,
      date: toIsoDate(a.madeOn),
      amount: a.amount.toString(),
      reason: a.reason,
    })),
    ...payments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      number: p.number,
      date: toIsoDate(p.paidOn),
      amount: p.amount.toString(),
      voided: !!p.voidedAt,
      method: p.method,
      reference: p.reference,
      reason: p.voidReason ?? p.notes,
      paidByName: p.paidBy?.name ?? null,
    })),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      ENTRY_ORDER[a.kind] - ENTRY_ORDER[b.kind] ||
      (a.number ?? "").localeCompare(b.number ?? ""),
  )
  return {
    lab,
    month,
    range,
    today,
    isCurrentMonth: month === today.slice(0, 7),
    ...labStatement(owedFrom(before(lab.id)), entries),
  }
}

export type LabStatementView = NonNullable<Awaited<ReturnType<typeof getLabStatement>>>
export type LabStatementRow = LabStatementView["rows"][number]

/** Labs to switch between on the statement page. */
export async function getLabChoices() {
  await authorize("lab:pay")
  return db.lab.findMany({
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: { id: true, name: true, archivedAt: true },
  })
}

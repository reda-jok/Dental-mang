import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { searchTokens } from "@/lib/arabic"
import { todayIso, toIsoDate } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"
import { db } from "@/server/db"
import { can } from "@/server/permissions"
import { authorize, type CurrentUser } from "@/server/session"

import { getClinicSettings } from "../settings/data"
import { paymentState } from "./rules"
import type { INVOICE_FILTERS } from "./schemas"

export const INVOICE_PAGE_SIZE = 20

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

async function clinicToday() {
  return todayIso((await getClinicSettings())?.timezone)
}

/** Dentists see the invoices they worked on; other billing roles see all. */
function visibleTo(user: CurrentUser): Prisma.InvoiceWhereInput {
  return user.role === "dentist" ? { lines: { some: { dentistId: user.id } } } : {}
}

const listSelect = {
  id: true,
  number: true,
  kind: true,
  status: true,
  issueDate: true,
  dueDate: true,
  total: true,
  patient: { select: { id: true, fullName: true, code: true } },
  lines: { orderBy: { sortOrder: "asc" }, take: 1, select: { description: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.InvoiceSelect

type ListRow = Prisma.InvoiceGetPayload<{ select: typeof listSelect }>

function toListRow(row: ListRow, today: string) {
  const dueDate = toIsoDate(row.dueDate)
  const total = row.total.toString()
  // Payments are recorded from the next billing part; until then nothing is paid.
  const paid = "0"
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    issueDate: toIsoDate(row.issueDate),
    dueDate,
    total,
    paid,
    balance: row.status === "void" ? "0" : total,
    state: paymentState({ status: row.status, total, paid, dueDate, today }),
    patient: row.patient,
    summary: row.lines[0]?.description ?? "",
    moreLines: Math.max(0, row._count.lines - 1),
  }
}

export type InvoiceListRow = ReturnType<typeof toListRow>

export async function listInvoices({
  q,
  status,
  page,
}: {
  q: string
  status: (typeof INVOICE_FILTERS)[number]
  page: number
}) {
  const user = await authorize("billing:read")
  const today = await clinicToday()
  const tokens = searchTokens(q)
  const where: Prisma.InvoiceWhereInput = {
    ...visibleTo(user),
    ...(status === "open" && { status: "issued" }),
    ...(status === "overdue" && { status: "issued", dueDate: { lt: asDate(today) } }),
    ...(status === "void" && { status: "void" }),
    AND: tokens.map((token) => ({
      OR: [
        { number: { contains: token, mode: "insensitive" } },
        { patient: { searchText: { contains: token } } },
      ],
    })),
  }
  const [total, rows] = await db.$transaction([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      select: listSelect,
    }),
  ])
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)),
    rows: rows.map((row) => toListRow(row, today)),
  }
}

export async function listPatientInvoices(patientId: string) {
  const user = await authorize("billing:read")
  const today = await clinicToday()
  const rows = await db.invoice.findMany({
    where: { patientId, ...visibleTo(user) },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    select: listSelect,
  })
  const invoices = rows.map((row) => toListRow(row, today))
  const live = invoices.filter((i) => i.state !== "void")
  return {
    invoices,
    totals: {
      invoiced: sum(live.map((i) => i.total)),
      paid: sum(live.map((i) => i.paid)),
      balance: sum(live.map((i) => i.balance)),
    },
  }
}

export async function getInvoice(id: string) {
  const user = await authorize("billing:read")
  const invoice = await db.invoice.findFirst({
    where: { id, ...visibleTo(user) },
    select: {
      id: true,
      number: true,
      kind: true,
      status: true,
      issueDate: true,
      dueDate: true,
      subtotal: true,
      extraDiscount: true,
      discountTotal: true,
      total: true,
      notes: true,
      createdAt: true,
      voidedAt: true,
      voidReason: true,
      patient: { select: { id: true, fullName: true, code: true, phone: true } },
      plan: { select: { id: true, title: true } },
      createdBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
      journalEntry: {
        select: { number: true, reversedBy: { select: { number: true } } },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          tooth: true,
          surfaces: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          total: true,
          dentist: { select: { name: true } },
        },
      },
    },
  })
  if (!invoice) return null
  const today = await clinicToday()
  const dueDate = toIsoDate(invoice.dueDate)
  const total = invoice.total.toString()
  const paid = "0"
  return {
    ...invoice,
    issueDate: toIsoDate(invoice.issueDate),
    dueDate,
    subtotal: invoice.subtotal.toString(),
    extraDiscount: invoice.extraDiscount.toString(),
    discountTotal: invoice.discountTotal.toString(),
    total,
    paid,
    balance: invoice.status === "void" ? "0" : total,
    state: paymentState({ status: invoice.status, total, paid, dueDate, today }),
    createdByName: invoice.createdBy?.name ?? null,
    voidedByName: invoice.voidedBy?.name ?? null,
    journalNumber: invoice.journalEntry?.number ?? null,
    reversalNumber: invoice.journalEntry?.reversedBy?.number ?? null,
    canVoid: invoice.status === "issued" && (await can(user, "billing:void")),
    lines: invoice.lines.map(({ dentist, unitPrice, discount, total: lineTotal, ...line }) => ({
      ...line,
      dentistName: dentist?.name ?? null,
      unitPrice: unitPrice.toString(),
      discount: discount.toString(),
      total: lineTotal.toString(),
    })),
  }
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>

/** What the new-invoice form needs: unbilled treatment, the catalog, defaults, rights. */
export async function getInvoiceFormData(patientId: string) {
  const user = await authorize("billing:write")
  const [settings, plans, categories, canDiscount] = await Promise.all([
    db.clinicSettings.findUnique({
      where: { id: 1 },
      select: { timezone: true, invoiceDueDays: true },
    }),
    db.treatmentPlan.findMany({
      where: { patientId, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        items: {
          where: { invoiceId: null, status: { not: "cancelled" } },
          orderBy: [{ phase: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            tooth: true,
            surfaces: true,
            status: true,
            price: true,
            discount: true,
            completedAt: true,
            procedure: { select: { name: true } },
            dentist: { select: { name: true } },
          },
        },
      },
    }),
    db.procedureCategory.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        procedures: {
          where: { archivedAt: null, price: { gt: 0 } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, price: true },
        },
      },
    }),
    can(user, "billing:discount"),
  ])
  return {
    today: todayIso(settings?.timezone),
    dueDays: settings?.invoiceDueDays ?? 30,
    canDiscount,
    plans: plans
      .filter((plan) => plan.items.length > 0)
      .map(({ items, ...plan }) => ({
        ...plan,
        items: items.map(({ procedure, dentist, price, discount, completedAt, ...item }) => ({
          ...item,
          procedureName: procedure.name,
          dentistName: dentist?.name ?? null,
          price: price.toString(),
          discount: discount.toString(),
          completedOn: completedAt ? toIsoDate(completedAt) : null,
        })),
      })),
    catalog: categories
      .filter((c) => c.procedures.length > 0)
      .map((c) => ({
        ...c,
        procedures: c.procedures.map((p) => ({ ...p, price: p.price.toString() })),
      })),
  }
}

export type InvoiceFormData = Awaited<ReturnType<typeof getInvoiceFormData>>

/** Numbers for the billing page header, plus patients with done but unbilled treatment. */
export async function getBillingSummary() {
  const user = await authorize("billing:read")
  const settings = await getClinicSettings()
  const today = todayIso(settings?.timezone)
  const issued: Prisma.InvoiceWhereInput = { status: "issued", ...visibleTo(user) }

  const [month, outstanding, overdue, unbilled] = await Promise.all([
    db.invoice.aggregate({
      where: { ...issued, issueDate: { gte: asDate(`${today.slice(0, 7)}-01`) } },
      _sum: { total: true },
      _count: true,
    }),
    db.invoice.aggregate({ where: issued, _sum: { total: true }, _count: true }),
    db.invoice.aggregate({
      where: { ...issued, dueDate: { lt: asDate(today) } },
      _sum: { total: true },
      _count: true,
    }),
    db.treatmentPlanItem.findMany({
      where: {
        status: "done",
        invoiceId: null,
        plan: { status: { not: "cancelled" }, patient: { deletedAt: null } },
        ...(user.role === "dentist" && { dentistId: user.id }),
      },
      orderBy: { completedAt: "desc" },
      take: 300,
      select: {
        price: true,
        discount: true,
        plan: { select: { patient: { select: { id: true, fullName: true, code: true } } } },
      },
    }),
  ])

  const byPatient = new Map<
    string,
    { id: string; fullName: string; code: string; items: number; amount: string }
  >()
  for (const item of unbilled) {
    const patient = item.plan.patient
    const entry = byPatient.get(patient.id) ?? { ...patient, items: 0, amount: "0" }
    entry.items++
    entry.amount = fromMinor(
      toMinor(entry.amount) + toMinor(item.price.toString()) - toMinor(item.discount.toString()),
    )
    byPatient.set(patient.id, entry)
  }

  return {
    monthTotal: month._sum.total?.toString() ?? "0",
    monthCount: month._count,
    outstanding: outstanding._sum.total?.toString() ?? "0",
    outstandingCount: outstanding._count,
    overdue: overdue._sum.total?.toString() ?? "0",
    overdueCount: overdue._count,
    unbilledItems: unbilled.length,
    unbilledPatients: [...byPatient.values()].slice(0, 8),
  }
}

function sum(amounts: string[]) {
  return fromMinor(amounts.reduce((total, amount) => total + toMinor(amount), 0n))
}

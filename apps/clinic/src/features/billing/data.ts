import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { searchTokens } from "@/lib/arabic"
import { todayIso, toIsoDate } from "@/lib/dates"
import { fromMinor, subtractAmounts, toMinor } from "@/lib/money"
import { db } from "@/server/db"
import { can } from "@/server/permissions"
import { authorize, type CurrentUser } from "@/server/session"

import { getClinicSettings } from "../settings/data"
import { AGE_BUCKETS, agePatientDebts, bucketTotals, type AgeBucket } from "./debts"
import { PAYMENT_METHODS, patientAccount, sumAmounts } from "./payments"
import { paymentState } from "./rules"
import type { DEBT_FILTERS, INVOICE_FILTERS } from "./schemas"

export const INVOICE_PAGE_SIZE = 20

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

async function clinicToday() {
  return todayIso((await getClinicSettings())?.timezone)
}

/** Dentists see the invoices they worked on; other billing roles see all. */
function visibleTo(user: CurrentUser): Prisma.InvoiceWhereInput {
  return user.role === "dentist" ? { lines: { some: { dentistId: user.id } } } : {}
}

/** Allocations that count: from payments that weren't voided. */
const countedAllocations = {
  where: { payment: { voidedAt: null } },
  select: { amount: true },
} as const

/**
 * Ids of live invoices by what's left to pay: "open" (anything left), "overdue" (and
 * past due), "paid" (nothing left). Paid amounts are always calculated, never stored.
 */
async function invoiceIdsByBalance(
  filter: "open" | "overdue" | "paid",
  today: string,
  dentistId: string | null,
) {
  const rows = await db.$queryRaw<{ id: string }[]>`
    select i.id from invoice i
    where i.status = 'issued'
      and i.total ${filter === "paid" ? Prisma.sql`<=` : Prisma.sql`>`} (
        select coalesce(sum(a.amount), 0) from payment_allocation a
        join payment p on p.id = a.payment_id
        where a.invoice_id = i.id and p.voided_at is null)
      ${filter === "overdue" ? Prisma.sql`and i.due_date < ${today}::date` : Prisma.empty}
      ${dentistOnly(dentistId)}`
  return rows.map((r) => r.id)
}

function dentistOnly(dentistId: string | null) {
  return dentistId
    ? Prisma.sql`and exists (select 1 from invoice_line l
        where l.invoice_id = i.id and l.dentist_id = ${dentistId}::uuid)`
    : Prisma.empty
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
  allocations: countedAllocations,
  _count: { select: { lines: true } },
} satisfies Prisma.InvoiceSelect

type ListRow = Prisma.InvoiceGetPayload<{ select: typeof listSelect }>

function toListRow(row: ListRow, today: string) {
  const dueDate = toIsoDate(row.dueDate)
  const total = row.total.toString()
  const paid = row.status === "void" ? "0" : sumAmounts(row.allocations.map((a) => a.amount))
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    issueDate: toIsoDate(row.issueDate),
    dueDate,
    total,
    paid,
    balance: row.status === "void" ? "0" : subtractAmounts(total, paid),
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
  const byBalance =
    status === "open" || status === "overdue" || status === "paid"
      ? await invoiceIdsByBalance(status, today, user.role === "dentist" ? user.id : null)
      : null
  const where: Prisma.InvoiceWhereInput = {
    ...visibleTo(user),
    ...(byBalance && { id: { in: byBalance } }),
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

/**
 * A patient's billing: invoices, and (except for dentists, who see only invoices with
 * their own work) payments, refunds and the account balance.
 */
export async function getPatientBilling(patientId: string) {
  const user = await authorize("billing:read")
  const today = await clinicToday()
  const rows = await db.invoice.findMany({
    where: { patientId, ...visibleTo(user) },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    select: listSelect,
  })
  const invoices = rows.map((row) => toListRow(row, today))
  if (user.role === "dentist") return { invoices, account: null, payments: [], refunds: [] }

  const [payments, refunds] = await Promise.all([
    db.payment.findMany({
      where: { patientId },
      orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        number: true,
        method: true,
        reference: true,
        amount: true,
        receivedOn: true,
        notes: true,
        voidedAt: true,
        voidReason: true,
        receivedBy: { select: { name: true } },
        allocations: {
          where: { invoice: { status: "issued" } },
          select: { amount: true, invoice: { select: { id: true, number: true } } },
        },
      },
    }),
    db.refund.findMany({
      where: { patientId },
      orderBy: [{ refundedOn: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        number: true,
        method: true,
        amount: true,
        refundedOn: true,
        reason: true,
        refundedBy: { select: { name: true } },
      },
    }),
  ])
  const live = invoices.filter((i) => i.state !== "void")
  const account = patientAccount({
    invoiced: sumAmounts(live.map((i) => i.total)),
    received: sumAmounts(payments.filter((p) => !p.voidedAt).map((p) => p.amount)),
    refunded: sumAmounts(refunds.map((r) => r.amount)),
  })
  return {
    invoices,
    account,
    payments: payments.map(({ receivedBy, amount, receivedOn, allocations, ...p }) => ({
      ...p,
      amount: amount.toString(),
      receivedOn: toIsoDate(receivedOn),
      receivedByName: receivedBy?.name ?? null,
      appliedTo: allocations.map((a) => ({ ...a.invoice, amount: a.amount.toString() })),
    })),
    refunds: refunds.map(({ refundedBy, amount, refundedOn, ...r }) => ({
      ...r,
      amount: amount.toString(),
      refundedOn: toIsoDate(refundedOn),
      refundedByName: refundedBy?.name ?? null,
    })),
  }
}

export type PatientBilling = Awaited<ReturnType<typeof getPatientBilling>>
export type PaymentRow = PatientBilling["payments"][number]

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
      allocations: {
        where: { payment: { voidedAt: null } },
        orderBy: { createdAt: "asc" },
        select: {
          amount: true,
          payment: { select: { id: true, number: true, method: true, receivedOn: true } },
        },
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
  const live = invoice.status === "issued"
  const paid = live ? sumAmounts(invoice.allocations.map((a) => a.amount)) : "0"
  const { allocations, ...rest } = invoice
  return {
    ...rest,
    issueDate: toIsoDate(invoice.issueDate),
    dueDate,
    subtotal: invoice.subtotal.toString(),
    extraDiscount: invoice.extraDiscount.toString(),
    discountTotal: invoice.discountTotal.toString(),
    total,
    paid,
    balance: live ? subtractAmounts(total, paid) : "0",
    state: paymentState({ status: invoice.status, total, paid, dueDate, today }),
    payments: live
      ? allocations.map(({ amount, payment }) => ({
          ...payment,
          receivedOn: toIsoDate(payment.receivedOn),
          amount: amount.toString(),
        }))
      : [],
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
  const monthStart = asDate(`${today.slice(0, 7)}-01`)
  const dentistId = user.role === "dentist" ? user.id : null

  const [month, [balances], unbilled, received, refunded] = await Promise.all([
    db.invoice.aggregate({
      where: { status: "issued", ...visibleTo(user), issueDate: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    db.$queryRaw<{ outstanding: string; open: bigint; overdue: string; late: bigint }[]>`
      select coalesce(sum(i.total - x.paid), 0)::text as outstanding, count(*) as open,
             coalesce(sum(i.total - x.paid) filter (where i.due_date < ${today}::date), 0)::text
               as overdue,
             count(*) filter (where i.due_date < ${today}::date) as late
      from invoice i
      cross join lateral (
        select coalesce(sum(a.amount), 0) as paid from payment_allocation a
        join payment p on p.id = a.payment_id
        where a.invoice_id = i.id and p.voided_at is null) x
      where i.status = 'issued' and i.total > x.paid ${dentistOnly(dentistId)}`,
    db.treatmentPlanItem.findMany({
      where: {
        status: "done",
        invoiceId: null,
        plan: { status: { not: "cancelled" }, patient: { deletedAt: null } },
        ...(dentistId && { dentistId }),
      },
      orderBy: { completedAt: "desc" },
      take: 300,
      select: {
        price: true,
        discount: true,
        plan: { select: { patient: { select: { id: true, fullName: true, code: true } } } },
      },
    }),
    // Money in and out is for the front desk and the owner, not per dentist.
    dentistId
      ? null
      : db.payment.groupBy({
          by: ["method"],
          where: { voidedAt: null, receivedOn: { gte: monthStart } },
          _sum: { amount: true },
          _count: true,
        }),
    dentistId
      ? null
      : db.refund.aggregate({ where: { refundedOn: { gte: monthStart } }, _sum: { amount: true } }),
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

  const methods = received
    ? PAYMENT_METHODS.map((method) => {
        const row = received.find((r) => r.method === method)
        return {
          method,
          amount: row?._sum.amount?.toString() ?? "0",
          count: row?._count ?? 0,
        }
      })
    : null

  return {
    monthTotal: month._sum.total?.toString() ?? "0",
    monthCount: month._count,
    outstanding: sumAmounts([balances?.outstanding ?? "0"]),
    outstandingCount: Number(balances?.open ?? 0),
    overdue: sumAmounts([balances?.overdue ?? "0"]),
    overdueCount: Number(balances?.late ?? 0),
    unbilledItems: unbilled.length,
    unbilledPatients: [...byPatient.values()].slice(0, 8),
    /** This month, net of refunds; null for dentists. */
    collected: methods
      ? subtractAmounts(
          sumAmounts(methods.map((m) => m.amount)),
          refunded?._sum.amount?.toString() ?? "0",
        )
      : null,
    methods,
  }
}

/** What the payment and refund forms need for one patient. */
export async function getPaymentFormData(patientId: string) {
  const user = await authorize("billing:write")
  const [settings, invoices, received, refunded, canRefund] = await Promise.all([
    getClinicSettings(),
    db.invoice.findMany({
      where: { patientId, status: "issued" },
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        total: true,
        dueDate: true,
        allocations: countedAllocations,
      },
    }),
    db.payment.aggregate({ where: { patientId, voidedAt: null }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { patientId }, _sum: { amount: true } }),
    can(user, "billing:refund"),
  ])
  const open = invoices
    .map((i) => ({
      id: i.id,
      number: i.number,
      dueDate: toIsoDate(i.dueDate),
      balance: subtractAmounts(i.total.toString(), sumAmounts(i.allocations.map((a) => a.amount))),
    }))
    .filter((i) => toMinor(i.balance) > 0n)
  return {
    today: todayIso(settings?.timezone),
    openInvoices: open,
    account: patientAccount({
      invoiced: sumAmounts(invoices.map((i) => i.total)),
      received: received._sum.amount?.toString() ?? "0",
      refunded: refunded._sum.amount?.toString() ?? "0",
    }),
    canRefund,
  }
}

export type PaymentFormData = Awaited<ReturnType<typeof getPaymentFormData>>

/** Each live invoice that still has something to pay, with what's left. */
async function openBalances(patientId?: string) {
  const rows = await db.$queryRaw<{ patient_id: string; due_date: string; balance: string }[]>`
    select i.patient_id, to_char(i.due_date, 'YYYY-MM-DD') as due_date,
           (i.total - x.paid)::text as balance
    from invoice i
    cross join lateral (
      select coalesce(sum(a.amount), 0) as paid from payment_allocation a
      join payment p on p.id = a.payment_id
      where a.invoice_id = i.id and p.voided_at is null) x
    where i.status = 'issued' and i.total > x.paid
      ${patientId ? Prisma.sql`and i.patient_id = ${patientId}::uuid` : Prisma.empty}`
  return rows.map((r) => ({ patientId: r.patient_id, dueDate: r.due_date, balance: r.balance }))
}

/**
 * Overdue debts per patient, oldest first: how much, how late (aging), when they last
 * paid and when they were last reminded. For the front desk and the owner.
 */
export async function getDebts({ q, age }: { q: string; age: (typeof DEBT_FILTERS)[number] }) {
  await authorize("billing:write")
  const settings = await getClinicSettings()
  const today = todayIso(settings?.timezone)
  const debts = agePatientDebts(await openBalances(), today)
  const overdue = debts.filter((d) => toMinor(d.overdue) > 0n)
  const minimum = AGE_BUCKETS.indexOf(age === "overdue" ? "d1_30" : age)
  const late = overdue.filter((d) => AGE_BUCKETS.indexOf(d.worst) >= minimum)

  const tokens = searchTokens(q)
  const ids = late.map((d) => d.patientId)
  const [patients, lastPayments, lastReminders] = await Promise.all([
    db.patient.findMany({
      where: {
        id: { in: ids },
        AND: tokens.map((token) => ({ searchText: { contains: token } })),
      },
      select: { id: true, fullName: true, code: true, phone: true },
    }),
    db.payment.groupBy({
      by: ["patientId"],
      where: { patientId: { in: ids }, voidedAt: null },
      _max: { receivedOn: true },
    }),
    db.paymentReminder.groupBy({
      by: ["patientId"],
      where: { patientId: { in: ids } },
      _max: { sentAt: true },
      _count: true,
    }),
  ])
  const patientById = new Map(patients.map((p) => [p.id, p]))
  const paidOn = new Map(lastPayments.map((p) => [p.patientId, p._max.receivedOn]))
  const reminded = new Map(lastReminders.map((r) => [r.patientId, r]))

  return {
    today,
    clinic: { name: settings?.name ?? "", phone: settings?.phone ?? null },
    totals: {
      ...bucketTotals(overdue),
      overdue: {
        amount: sumAmounts(overdue.map((d) => d.overdue)),
        patients: overdue.length,
      },
    } as Record<AgeBucket | "overdue", { amount: string; patients: number }>,
    rows: late
      .filter((d) => patientById.has(d.patientId))
      .sort(
        (a, b) =>
          b.daysLate - a.daysLate ||
          (toMinor(b.overdue) > toMinor(a.overdue)
            ? 1
            : toMinor(b.overdue) < toMinor(a.overdue)
              ? -1
              : 0),
      )
      .slice(0, 200)
      .map((d) => {
        const lastPaid = paidOn.get(d.patientId)
        const reminder = reminded.get(d.patientId)
        return {
          ...d,
          patient: patientById.get(d.patientId)!,
          lastPaidOn: lastPaid ? toIsoDate(lastPaid) : null,
          lastRemindedAt: reminder?._max.sentAt ?? null,
          reminders: reminder?._count ?? 0,
        }
      }),
  }
}

export type DebtRow = Awaited<ReturnType<typeof getDebts>>["rows"][number]

/** One patient's overdue debt (for the banner on their billing tab), or null if not late. */
export async function getPatientDebt(patientId: string) {
  const user = await authorize("billing:read")
  if (user.role === "dentist") return null
  const settings = await getClinicSettings()
  const [debt] = agePatientDebts(await openBalances(patientId), todayIso(settings?.timezone))
  if (!debt || toMinor(debt.overdue) === 0n) return null
  const last = await db.paymentReminder.findFirst({
    where: { patientId },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  })
  return {
    ...debt,
    lastRemindedAt: last?.sentAt ?? null,
    clinic: { name: settings?.name ?? "", phone: settings?.phone ?? null },
  }
}

import "server-only"

import { nextMonth, startOfDayUtc, todayIso, toIsoDate } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import { authorize, type CurrentUser } from "@/server/session"

import { dentistMonth, payFor, type CommissionLine } from "./commission"

const tz = () => env.CLINIC_TIMEZONE

export const currentMonth = () => todayIso(tz()).slice(0, 7)

function monthRange(month: string) {
  return {
    start: startOfDayUtc(`${month}-01`, tz()),
    end: startOfDayUtc(`${nextMonth(month)}-01`, tz()),
    startDay: new Date(`${month}-01T00:00:00Z`),
    endDay: new Date(`${nextMonth(month)}-01T00:00:00Z`),
  }
}

/** Every dentist for those who see everyone's commission; otherwise only yourself. */
function canSeeAll(user: CurrentUser) {
  return hasPermission(user, "hr:commission")
}

async function payVersions(dentistIds: string[]) {
  const rows = await db.dentistPay.findMany({
    where: { dentistId: { in: dentistIds } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      dentistId: true,
      payType: true,
      commissionRate: true,
      monthlySalary: true,
      deductLab: true,
      effectiveFrom: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    dentistId: r.dentistId,
    payType: r.payType,
    commissionRate: r.commissionRate.toString(),
    monthlySalary: r.monthlySalary?.toString() ?? null,
    deductLab: r.deductLab,
    effectiveFrom: toIsoDate(r.effectiveFrom).slice(0, 7),
    createdAt: r.createdAt,
    createdByName: r.createdBy?.name ?? null,
  }))
}

/**
 * Invoice lines by these dentists whose commission moved in the month: money applied,
 * a void, or a lab bill for the treatment. Each comes with every allocation and lab bill
 * it has ever had, because the month is the change between its start and its end.
 */
async function linesForMonth(dentistIds: string[], month: string) {
  const { start, end, startDay, endDay } = monthRange(month)
  const inMonth = { gte: start, lt: end }
  const rows = await db.invoiceLine.findMany({
    where: {
      dentistId: { in: dentistIds },
      OR: [
        { invoice: { allocations: { some: { createdAt: inMonth } } } },
        { invoice: { voidedAt: inMonth } },
        { invoice: { allocations: { some: { payment: { voidedAt: inMonth } } } } },
        { planItem: { labCases: { some: { billedOn: { gte: startDay, lt: endDay } } } } },
      ],
    },
    orderBy: [{ invoice: { issueDate: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      dentistId: true,
      description: true,
      tooth: true,
      total: true,
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          voidedAt: true,
          patient: { select: { id: true, fullName: true, code: true } },
          lines: { select: { total: true } },
          allocations: {
            select: { amount: true, createdAt: true, payment: { select: { voidedAt: true } } },
          },
        },
      },
      planItem: {
        select: {
          labCases: {
            where: { billedOn: { not: null } },
            select: { cost: true, billedOn: true },
          },
        },
      },
    },
  })
  return rows.map((r) => {
    const line: CommissionLine = {
      lineId: r.id,
      lineTotal: r.total.toString(),
      linesTotal: fromMinor(
        r.invoice.lines.reduce((sum, l) => sum + toMinor(l.total.toString()), 0n),
      ),
      invoiceTotal: r.invoice.total.toString(),
      allocations: r.invoice.allocations.map((a) => ({
        amount: a.amount.toString(),
        at: a.createdAt,
        until: earliest(r.invoice.voidedAt, a.payment.voidedAt),
      })),
      labBills: (r.planItem?.labCases ?? []).map((c) => ({
        cost: c.cost.toString(),
        at: startOfDayUtc(toIsoDate(c.billedOn!), tz()),
      })),
    }
    return {
      line,
      dentistId: r.dentistId!,
      detail: {
        lineId: r.id,
        description: r.description,
        tooth: r.tooth,
        invoiceId: r.invoice.id,
        invoiceNumber: r.invoice.number,
        patient: r.invoice.patient,
      },
    }
  })
}

function earliest(a: Date | null, b: Date | null) {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

/** The month's commission for every dentist (or just yourself, for a dentist). */
export async function getCommissionReport(month: string) {
  const user = await authorize("hr:self")
  const all = canSeeAll(user)
  if (!all && user.role !== "dentist") throw new AppError("forbidden")
  const { start, end } = monthRange(month)
  const dentists = await db.user.findMany({
    where: all ? { role: "dentist" } : { id: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, banned: true },
  })
  const ids = dentists.map((d) => d.id)
  const [versions, lines] = await Promise.all([payVersions(ids), linesForMonth(ids, month)])
  const rows = dentists
    .map((dentist) => {
      const pay = payFor(
        versions.filter((v) => v.dentistId === dentist.id),
        month,
      )
      const result = dentistMonth(
        lines.filter((l) => l.dentistId === dentist.id).map((l) => l.line),
        pay,
        start,
        end,
      )
      return { dentist, pay, ...result }
    })
    // A former dentist only while they still have something this month.
    .filter((r) => !r.dentist.banned || r.lines.length > 0)
  return { month, all, rows }
}

export type CommissionRow = Awaited<ReturnType<typeof getCommissionReport>>["rows"][number]

/**
 * What all dentists earned in each month (commission + salary), for the profit and loss:
 * the same figures as the commission report, summed. Checks the reports permission, so
 * reading the accounts doesn't need access to staff pay.
 */
export async function dentistPayByMonth(months: readonly string[]) {
  await authorize("accounting:reports")
  const dentists = await db.user.findMany({
    where: { role: "dentist" },
    select: { id: true, banned: true },
  })
  const ids = dentists.map((d) => d.id)
  const versions = await payVersions(ids)
  const totals = await Promise.all(
    months.map(async (month) => {
      const { start, end } = monthRange(month)
      const lines = await linesForMonth(ids, month)
      let total = 0n
      for (const dentist of dentists) {
        const result = dentistMonth(
          lines.filter((l) => l.dentistId === dentist.id).map((l) => l.line),
          payFor(
            versions.filter((v) => v.dentistId === dentist.id),
            month,
          ),
          start,
          end,
        )
        // A former dentist only while they still have something this month (as the report).
        if (!dentist.banned || result.lines.length > 0) total += toMinor(result.total)
      }
      return [month, fromMinor(total)] as const
    }),
  )
  return new Map(totals)
}

/** One dentist's month: the treatments behind the figure, and their pay history. */
export async function getDentistCommission(dentistId: string, month: string) {
  const user = await authorize("hr:self")
  if (!canSeeAll(user) && user.id !== dentistId) throw new AppError("not_found")
  const dentist = await db.user.findFirst({
    where: { id: dentistId, role: "dentist" },
    select: { id: true, name: true, banned: true },
  })
  if (!dentist) throw new AppError("not_found")
  const { start, end } = monthRange(month)
  const [versions, lines] = await Promise.all([
    payVersions([dentistId]),
    linesForMonth([dentistId], month),
  ])
  const pay = payFor(versions, month)
  const result = dentistMonth(
    lines.map((l) => l.line),
    pay,
    start,
    end,
  )
  const details = new Map(lines.map((l) => [l.line.lineId, l.detail]))
  return {
    month,
    dentist,
    pay,
    history: versions,
    ...result,
    lines: result.lines.map((l) => ({ ...l, ...details.get(l.lineId)! })),
  }
}

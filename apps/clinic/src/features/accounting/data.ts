import "server-only"

import { nextMonth, todayIso, toIsoDate } from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { ACCOUNTS } from "../ledger/accounts"
import { EXPENSE_CATEGORIES, expenseTotals, type ExpenseCategory } from "./expenses"

/** Account code → its category key, for the expense accounts staff choose from. */
const CATEGORY_BY_CODE = new Map<string, ExpenseCategory>(
  EXPENSE_CATEGORIES.map((c) => [ACCOUNTS[c], c]),
)

/** "YYYY-MM" of today in the clinic's time zone. */
export const currentMonth = () => todayIso(env.CLINIC_TIMEZONE).slice(0, 7)

/** A month as calendar days (paid_on is a date): [1st, 1st of next month). */
const monthDays = (month: string) => ({
  start: new Date(`${month}-01T00:00:00Z`),
  end: new Date(`${nextMonth(month)}-01T00:00:00Z`),
})

/** A month's expenses, newest first, with the month's totals (voided ones shown, not counted). */
export async function listExpenses(filter: {
  month?: string
  category?: ExpenseCategory
  q?: string
}) {
  await authorize("accounting:read")
  const month = filter.month ?? currentMonth()
  const { start, end } = monthDays(month)
  const rows = await db.expense.findMany({
    where: {
      paidOn: { gte: start, lt: end },
      ...(filter.category && { account: { code: ACCOUNTS[filter.category] } }),
      ...(filter.q && {
        OR: [
          { description: { contains: filter.q, mode: "insensitive" } },
          { payee: { contains: filter.q, mode: "insensitive" } },
          { number: { contains: filter.q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      number: true,
      paidOn: true,
      method: true,
      amount: true,
      description: true,
      payee: true,
      reference: true,
      createdAt: true,
      voidedAt: true,
      voidReason: true,
      account: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
    },
  })
  const expenses = rows.map((r) => ({
    id: r.id,
    number: r.number,
    paidOn: toIsoDate(r.paidOn),
    category: CATEGORY_BY_CODE.get(r.account.code) ?? null,
    accountName: r.account.name,
    method: r.method,
    amount: r.amount.toString(),
    description: r.description,
    payee: r.payee,
    reference: r.reference,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt,
    voided: r.voidedAt !== null,
    voidReason: r.voidReason,
  }))
  return {
    month,
    expenses,
    totals: expenseTotals(
      expenses.map((e) => ({
        category: e.category ?? e.accountName,
        method: e.method,
        amount: e.amount,
        voided: e.voided,
      })),
    ),
  }
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>["expenses"][number]

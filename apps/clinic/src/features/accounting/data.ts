import "server-only"

import { nextMonth, previousMonth, todayIso, toIsoDate } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { dentistPayByMonth } from "../hr/data"
import { ACCOUNTS } from "../ledger/accounts"
import { EXPENSE_CATEGORIES, expenseTotals, type ExpenseCategory } from "./expenses"
import {
  cashBook,
  profitAndLoss,
  withShares,
  type LedgerMonthRow,
  type MoneyMonthRow,
} from "./reports"
import type { MoneyAccount } from "./schemas"

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

/** The month and the five before it, oldest first. */
function lastSixMonths(month: string) {
  const months = [month]
  while (months.length < 6) months.unshift(previousMonth(months[0]!))
  return months
}

/** Profit and loss for the month, the month before beside it, and six months of profit. */
export async function getProfitAndLoss(month = currentMonth()) {
  await authorize("accounting:reports")
  const months = lastSixMonths(month)
  const from = `${months[0]}-01`
  const to = `${nextMonth(month)}-01`
  const [ledger, collected, dentistPay] = await Promise.all([
    db.$queryRaw<LedgerMonthRow[]>`
      select to_char(e.date, 'YYYY-MM') as month, a.code, a.name, a.type::text as type,
             sum(l.debit)::text as debit, sum(l.credit)::text as credit
      from journal_line l
      join journal_entry e on e.id = l.entry_id
      join ledger_account a on a.id = l.account_id
      where a.type in ('revenue', 'expense') and e.date >= ${from}::date and e.date < ${to}::date
      group by 1, 2, 3, 4`,
    // Money from patients: payments less refunds (voids land in the month they happen).
    db.$queryRaw<MoneyMonthRow[]>`
      select to_char(e.date, 'YYYY-MM') as month,
             sum(l.debit)::text as debit, sum(l.credit)::text as credit
      from journal_line l
      join journal_entry e on e.id = l.entry_id
      join ledger_account a on a.id = l.account_id
      where a.code in (${ACCOUNTS.cash}, ${ACCOUNTS.card}, ${ACCOUNTS.wallet})
        and e.source_type in ('payment', 'refund')
        and e.date >= ${from}::date and e.date < ${to}::date
      group by 1`,
    dentistPayByMonth(months),
  ])
  return { month, ...profitAndLoss(months, ledger, dentistPay, collected) }
}

/** Each movement of one money account in the month, with the running balance. */
export async function getCashBook(account: MoneyAccount, month = currentMonth()) {
  await authorize("accounting:reports")
  const code = ACCOUNTS[account]
  const from = `${month}-01`
  const to = `${nextMonth(month)}-01`
  const [[opening], rows] = await Promise.all([
    db.$queryRaw<{ debit: string; credit: string }[]>`
      select coalesce(sum(l.debit), 0)::text as debit, coalesce(sum(l.credit), 0)::text as credit
      from journal_line l
      join journal_entry e on e.id = l.entry_id
      join ledger_account a on a.id = l.account_id
      where a.code = ${code} and e.date < ${from}::date`,
    // What each movement was, and for whom: the patient, the lab or the expense.
    db.$queryRaw<
      {
        id: string
        date: Date
        source: string
        reversal: boolean
        number: string | null
        party: string | null
        taken_to: "owner" | "bank" | null
        debit: string
        credit: string
      }[]
    >`
      select l.id, e.date, e.source_type as source, e.reverses_id is not null as reversal,
             coalesce(p.number, r.number, lp.number, x.number) as number,
             coalesce(pp.full_name, rp.full_name, lb.name, x.description) as party,
             cc.taken_to::text as taken_to,
             l.debit::text as debit, l.credit::text as credit
      from journal_line l
      join journal_entry e on e.id = l.entry_id
      join ledger_account a on a.id = l.account_id
      left join payment p on e.source_type = 'payment' and p.id = e.source_id
      left join patient pp on pp.id = p.patient_id
      left join refund r on e.source_type = 'refund' and r.id = e.source_id
      left join patient rp on rp.id = r.patient_id
      left join lab_payment lp on e.source_type = 'lab_payment' and lp.id = e.source_id
      left join lab lb on lb.id = lp.lab_id
      left join expense x on e.source_type = 'expense' and x.id = e.source_id
      left join cash_close cc on e.source_type = 'cash_takeout' and cc.id = e.source_id
      where a.code = ${code} and e.date >= ${from}::date and e.date < ${to}::date
      order by e.date, e.created_at, e.number`,
  ])
  const book = cashBook(
    opening!,
    rows.map((r) => ({ ...r, date: toIsoDate(r.date) })),
  )
  return { month, account, ...book }
}

export type CashBookRow = Awaited<ReturnType<typeof getCashBook>>["rows"][number]

/**
 * The month's treatments billed, by dentist and by kind of treatment (an invoice voided
 * in the month counts against it, as in the books), and the money collected by method.
 */
export async function getRevenueBreakdown(month = currentMonth()) {
  await authorize("accounting:reports")
  const from = `${month}-01`
  const to = `${nextMonth(month)}-01`
  const [lines, [extra], methods] = await Promise.all([
    db.$queryRaw<
      {
        dentist_id: string | null
        dentist: string | null
        category_id: string | null
        category: string | null
        amount: string
      }[]
    >`
      select l.dentist_id, u.name as dentist, c.id as category_id, c.name as category,
             sum(case when e.reverses_id is null then l.total else -l.total end)::text as amount
      from journal_entry e
      join invoice i on i.id = e.source_id
      join invoice_line l on l.invoice_id = i.id
      left join "user" u on u.id = l.dentist_id
      left join procedure pr on pr.id = l.procedure_id
      left join procedure_category c on c.id = pr.category_id
      where e.source_type = 'invoice' and e.date >= ${from}::date and e.date < ${to}::date
      group by 1, 2, 3, 4`,
    // Discounts on a whole invoice belong to no line.
    db.$queryRaw<{ amount: string }[]>`
      select coalesce(sum(case when e.reverses_id is null then i.extra_discount
                               else -i.extra_discount end), 0)::text as amount
      from journal_entry e
      join invoice i on i.id = e.source_id
      where e.source_type = 'invoice' and e.date >= ${from}::date and e.date < ${to}::date`,
    db.$queryRaw<{ code: string; debit: string; credit: string }[]>`
      select a.code, sum(l.debit)::text as debit, sum(l.credit)::text as credit
      from journal_line l
      join journal_entry e on e.id = l.entry_id
      join ledger_account a on a.id = l.account_id
      where a.code in (${ACCOUNTS.cash}, ${ACCOUNTS.card}, ${ACCOUNTS.wallet})
        and e.source_type in ('payment', 'refund')
        and e.date >= ${from}::date and e.date < ${to}::date
      group by 1`,
  ])
  const sumBy = (
    key: (l: (typeof lines)[number]) => string,
    label: (l: (typeof lines)[number]) => string | null,
  ) => {
    const totals = new Map<string, { key: string; label: string | null; minor: bigint }>()
    for (const l of lines) {
      const k = key(l)
      const t = totals.get(k) ?? { key: k, label: label(l), minor: 0n }
      t.minor += toMinor(l.amount)
      totals.set(k, t)
    }
    return withShares(
      [...totals.values()].map((t) => ({ key: t.key, label: t.label, amount: fromMinor(t.minor) })),
    )
  }
  const methodOf = new Map(
    (["cash", "card", "wallet"] as const).map((m) => [ACCOUNTS[m] as string, m]),
  )
  return {
    month,
    byDentist: sumBy(
      (l) => l.dentist_id ?? "none",
      (l) => l.dentist,
    ),
    byCategory: sumBy(
      (l) => l.category_id ?? "none",
      (l) => l.category,
    ),
    extraDiscount: extra!.amount,
    byMethod: withShares(
      methods.map((m) => ({
        key: methodOf.get(m.code)!,
        label: null,
        amount: fromMinor(toMinor(m.debit) - toMinor(m.credit)),
      })),
    ),
  }
}

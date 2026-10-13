// What an invoice asks for, and when. Every invoice has a schedule: one due date for the
// whole total, or (plan invoices) monthly installments like the printed plan. Money paid
// covers the earliest installments first, so only installments already due can be late.
// Pure, shared by the invoice form (preview), the server and the tests.

import { addMonths } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"

import { paymentSchedule } from "../printing/quote"

export type Installment = { dueDate: string; amount: string; deposit: boolean }

/** One due date for the whole invoice. */
export function singleDue(total: string, dueDate: string): Installment[] {
  return [{ dueDate, amount: total, deposit: false }]
}

/**
 * Monthly installments, as on the printed plan: an optional deposit due on the issue date,
 * then `months` payments in whole thousands (the last takes the remainder), the first
 * on `firstDue` and then the same day each month. Rows always add up to the total.
 */
export function monthlyInstallments(input: {
  total: string
  months: number
  depositPercent: number
  issueDate: string
  firstDue: string
}): Installment[] {
  const { lines } = paymentSchedule({
    phases: [{ phase: 1, net: input.total }],
    paid: "0",
    mode: "months",
    months: input.months,
    depositPercent: input.depositPercent,
  })
  return lines
    .map((line) =>
      line.kind === "month"
        ? {
            dueDate: addMonths(input.firstDue, line.month - 1),
            amount: line.amount,
            deposit: false,
          }
        : { dueDate: input.issueDate, amount: line.amount, deposit: true },
    )
    .filter((row) => toMinor(row.amount) > 0n)
}

/** What's still unpaid of each installment (in due order): payments cover the earliest first. */
export function unpaidInstallments<T extends { dueDate: string; amount: string }>(
  installments: readonly T[],
  paid: string,
): (T & { unpaid: string })[] {
  let credit = toMinor(paid)
  return installments.map((installment) => {
    const amount = toMinor(installment.amount)
    const covered = credit < amount ? credit : amount
    credit -= covered
    return { ...installment, unpaid: fromMinor(amount - covered) }
  })
}

/** The part that is late: installments due before today, less what has been paid. */
export function overdueAmount(
  installments: readonly { dueDate: string; amount: string }[],
  paid: string,
  today: string,
): string {
  const due = installments
    .filter((i) => i.dueDate < today)
    .reduce((sum, i) => sum + toMinor(i.amount), 0n)
  const late = due - toMinor(paid)
  return fromMinor(late > 0n ? late : 0n)
}

/** The next installment with something left to pay, or null when it's all paid. */
export function nextDue<T extends { dueDate: string; amount: string }>(
  installments: readonly T[],
  paid: string,
) {
  return unpaidInstallments(installments, paid).find((i) => toMinor(i.unpaid) > 0n) ?? null
}

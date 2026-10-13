import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { clockOf, type Clock } from "../billing/service"
import { ACCOUNTS } from "../ledger/accounts"
import { postJournal, reverseJournal } from "../ledger/service"
import { expensePosting } from "./expenses"
import type { recordExpenseSchema, voidExpenseSchema } from "./schemas"

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

/**
 * Records money the clinic spent, today: Dr the expense account, Cr where it was paid
 * from. A cash expense comes out of the drawer, so today's close counts it.
 */
export async function recordExpense(
  actor: CurrentUser,
  input: z.output<typeof recordExpenseSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, number: true },
    })
    if (existing) return existing

    const { day } = await clockOf(tx, clock)
    const account = await tx.ledgerAccount.findUnique({
      where: { code: ACCOUNTS[input.category] },
      select: { id: true },
    })
    if (!account) throw new AppError("internal")
    const [row] = await tx.$queryRaw<{ n: bigint }[]>`select nextval('expense_number_seq') as n`
    const number = `EX-${day.slice(0, 4)}-${String(row!.n).padStart(6, "0")}`
    const id = crypto.randomUUID()
    const entry = await postJournal(tx, {
      date: day,
      description: `${number} · ${input.description}`,
      source: { type: "expense", id },
      lines: expensePosting(input.category, input.method, input.amount),
      userId: actor.id,
    })
    await tx.expense.create({
      data: {
        id,
        number,
        accountId: account.id,
        method: input.method,
        amount: input.amount,
        paidOn: asDate(day),
        description: input.description,
        payee: input.payee,
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
        journalEntryId: entry.id,
        createdById: actor.id,
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "expense",
      entityId: id,
      after: {
        number,
        category: input.category,
        method: input.method,
        amount: input.amount,
        description: input.description,
      },
    })
    return { id, number }
  })
}

/** Voids an expense entered by mistake: kept on record, its journal entry reversed. */
export async function voidExpense(
  actor: CurrentUser,
  input: z.output<typeof voidExpenseSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day, at } = await clockOf(tx, clock)
    const expense = await tx.expense.findUnique({
      where: { id: input.id },
      select: { number: true, amount: true, journalEntryId: true },
    })
    if (!expense) throw new AppError("not_found")
    const voided = await tx.expense.updateMany({
      where: { id: input.id, voidedAt: null },
      data: { voidedAt: at, voidedById: actor.id, voidReason: input.reason },
    })
    if (voided.count === 0) throw new AppError("conflict", "expenseAlreadyVoid")
    if (expense.journalEntryId) {
      await reverseJournal(tx, expense.journalEntryId, {
        date: day,
        description: expense.number,
        userId: actor.id,
      })
    }
    await recordAudit(tx, {
      userId: actor.id,
      action: "void",
      entity: "expense",
      entityId: input.id,
      before: { amount: expense.amount },
      after: { reason: input.reason },
    })
    return { number: expense.number }
  })
}

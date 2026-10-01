import "server-only"

import type { z } from "zod"

import { todayIso } from "@/lib/dates"
import { fromMinor, subtractAmounts, toMinor } from "@/lib/money"
import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import { can } from "@/server/permissions"
import type { CurrentUser } from "@/server/session"

import { postJournal, reverseJournal } from "../ledger/service"
import {
  allocate,
  documentNumber,
  paymentPosting,
  refundPosting,
  sumAmounts,
  unappliedMoney,
} from "./payments"
import { givesNewDiscount, invoiceNumber, invoicePosting, invoiceTotals } from "./rules"
import type {
  createInvoiceSchema,
  paymentReminderSchema,
  recordPaymentSchema,
  refundSchema,
  voidInvoiceSchema,
  voidPaymentSchema,
} from "./schemas"

/**
 * When a change happens: the clinic day it's recorded on, and the moment. The app always
 * uses now; the demo seed (prisma/demo) passes past days to build a realistic history.
 */
export type Clock = { day: string; at: Date }

async function clockOf(tx: Db, clock?: Clock): Promise<Clock> {
  if (clock) return clock
  const settings = await tx.clinicSettings.findUnique({
    where: { id: 1 },
    select: { timezone: true },
  })
  return { day: todayIso(settings?.timezone), at: new Date() }
}

/**
 * Locks the patient row for the rest of the transaction, so a patient's invoices,
 * payments and refunds are applied one at a time (no double use of the same credit).
 */
async function lockPatient(tx: Db, patientId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    select id from patient where id = ${patientId}::uuid and deleted_at is null for update`
  if (rows.length === 0) throw new AppError("not_found")
}

/**
 * Applies the patient's unapplied money to their open invoices: `preferredInvoiceId`
 * first, then the oldest due. Allocations to void invoices or from void payments
 * don't count, so that money is available again.
 */
async function settle(tx: Db, patientId: string, preferredInvoiceId?: string | null) {
  // One query at a time: a transaction runs on a single connection.
  const payments = await tx.payment.findMany({
    where: { patientId, voidedAt: null },
    orderBy: [{ receivedOn: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amount: true,
      allocations: { where: { invoice: { status: "issued" } }, select: { amount: true } },
    },
  })
  const invoices = await tx.invoice.findMany({
    where: { patientId, status: "issued" },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }, { number: "asc" }],
    select: {
      id: true,
      total: true,
      allocations: { where: { payment: { voidedAt: null } }, select: { amount: true } },
    },
  })
  const refunds = await tx.refund.findMany({ where: { patientId }, select: { amount: true } })
  const money = unappliedMoney(
    payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      applied: sumAmounts(p.allocations.map((a) => a.amount)),
    })),
    sumAmounts(refunds.map((r) => r.amount)),
  )
  const open = invoices
    .map((i) => ({
      id: i.id,
      balance: subtractAmounts(i.total.toString(), sumAmounts(i.allocations.map((a) => a.amount))),
    }))
    .filter((i) => toMinor(i.balance) > 0n)
  const allocations = allocate(money, open, preferredInvoiceId)
  if (allocations.length) await tx.paymentAllocation.createMany({ data: allocations })
  return allocations
}

async function nextNumber(tx: Db, sequence: "receipt_number_seq" | "refund_number_seq") {
  const rows =
    sequence === "receipt_number_seq"
      ? await tx.$queryRaw<{ n: bigint }[]>`select nextval('receipt_number_seq') as n`
      : await tx.$queryRaw<{ n: bigint }[]>`select nextval('refund_number_seq') as n`
  return rows[0]!.n
}

/**
 * Issues an invoice. Prices come from the treatment plan or the catalog (never from the
 * browser). In one transaction: the invoice and its lines, the journal entry, the plan
 * items marked as billed, and the audit entry.
 */
export async function createInvoice(
  actor: CurrentUser,
  input: z.output<typeof createInvoiceSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day: today } = await clockOf(tx, clock)
    if (input.dueDate < today) {
      throw new AppError("validation", "dueBeforeIssue", { dueDate: ["dueBeforeIssue"] })
    }

    await lockPatient(tx, input.patientId)
    const patient = { id: input.patientId }

    const planId = input.kind === "plan" ? input.planId || null : null
    if (planId) {
      const plan = await tx.treatmentPlan.findFirst({
        where: { id: planId, patientId: patient.id, status: { not: "cancelled" } },
        select: { id: true },
      })
      if (!plan) throw new AppError("not_found")
    }

    // Plan items: the patient's, not billed yet, not cancelled; a visit bills done work only.
    const planItemIds = input.lines.flatMap((line) => (line.planItemId ? [line.planItemId] : []))
    if (new Set(planItemIds).size !== planItemIds.length) throw new AppError("validation")
    const items = await tx.treatmentPlanItem.findMany({
      where: { id: { in: planItemIds }, plan: { patientId: patient.id } },
      select: {
        id: true,
        planId: true,
        status: true,
        invoiceId: true,
        procedureId: true,
        tooth: true,
        surfaces: true,
        dentistId: true,
        price: true,
        discount: true,
        procedure: { select: { name: true } },
        plan: { select: { status: true } },
      },
    })
    if (items.length !== planItemIds.length) throw new AppError("not_found")
    for (const item of items) {
      if (item.invoiceId) throw new AppError("conflict", "itemsAlreadyBilled")
      if (item.status === "cancelled" || item.plan.status === "cancelled") {
        throw new AppError("conflict", "itemCancelled")
      }
      if (input.kind === "visit" && item.status !== "done") {
        throw new AppError("validation", "itemNotDone")
      }
      if (planId && item.planId !== planId) throw new AppError("validation")
    }

    const procedureIds = [
      ...new Set(input.lines.flatMap((line) => (line.procedureId ? [line.procedureId] : []))),
    ]
    const procedures = await tx.procedure.findMany({
      where: { id: { in: procedureIds }, archivedAt: null },
      select: { id: true, name: true, price: true },
    })
    if (procedures.length !== procedureIds.length) {
      throw new AppError("validation", "procedureMissing")
    }

    const itemById = new Map(items.map((item) => [item.id, item]))
    const procedureById = new Map(procedures.map((p) => [p.id, p]))
    const lines = input.lines.map((line, index) => {
      if (line.planItemId) {
        const item = itemById.get(line.planItemId)!
        return {
          sortOrder: index,
          planItemId: item.id,
          procedureId: item.procedureId,
          description: item.procedure.name,
          tooth: item.tooth,
          surfaces: item.surfaces,
          dentistId: item.dentistId,
          quantity: 1, // one plan item = one tooth / one treatment
          unitPrice: item.price.toString(),
          discount: line.discount,
          agreedDiscount: item.discount.toString(),
        }
      }
      const procedure = procedureById.get(line.procedureId!)!
      return {
        sortOrder: index,
        planItemId: null,
        procedureId: procedure.id,
        description: procedure.name,
        tooth: null,
        surfaces: [],
        dentistId: actor.role === "dentist" ? actor.id : null,
        quantity: line.quantity,
        unitPrice: procedure.price.toString(),
        discount: line.discount,
        agreedDiscount: "0",
      }
    })

    if (givesNewDiscount(lines, input.extraDiscount) && !(await can(actor, "billing:discount"))) {
      throw new AppError("forbidden", "discountNotAllowed")
    }

    const result = invoiceTotals(lines, input.extraDiscount)
    if (!result.ok) {
      const field =
        result.line !== undefined
          ? `lines.${result.line}.discount`
          : result.error === "extraDiscountTooLarge"
            ? "extraDiscount"
            : null
      throw new AppError(
        "validation",
        result.error,
        field ? { [field]: [result.error] } : undefined,
      )
    }
    const { totals } = result

    const [row] = await tx.$queryRaw<{ n: bigint }[]>`select nextval('invoice_number_seq') as n`
    const id = crypto.randomUUID()
    const number = invoiceNumber(today, row!.n)

    // The entry is posted first so the invoice is created complete (it can't be edited later).
    const entry = await postJournal(tx, {
      date: today,
      description: number,
      source: { type: "invoice", id },
      lines: invoicePosting(totals),
      userId: actor.id,
    })

    await tx.invoice.create({
      data: {
        id,
        number,
        patientId: patient.id,
        kind: input.kind,
        planId,
        issueDate: new Date(`${today}T00:00:00Z`),
        dueDate: new Date(`${input.dueDate}T00:00:00Z`),
        subtotal: totals.subtotal,
        extraDiscount: totals.extraDiscount,
        discountTotal: totals.discountTotal,
        total: totals.total,
        notes: input.notes,
        journalEntryId: entry.id,
        createdById: actor.id,
        lines: {
          create: lines.map((line, index) => ({
            sortOrder: line.sortOrder,
            planItemId: line.planItemId,
            procedureId: line.procedureId,
            description: line.description,
            tooth: line.tooth,
            surfaces: line.surfaces,
            dentistId: line.dentistId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount,
            total: totals.lines[index]!.total,
          })),
        },
      },
    })

    // Claim the plan items. If someone billed one of them a moment ago, nothing is saved.
    if (planItemIds.length) {
      const claimed = await tx.treatmentPlanItem.updateMany({
        where: { id: { in: planItemIds }, invoiceId: null },
        data: { invoiceId: id },
      })
      if (claimed.count !== planItemIds.length) {
        throw new AppError("conflict", "itemsAlreadyBilled")
      }
    }

    // Credit the patient already has (a deposit, an overpayment) pays this invoice.
    await settle(tx, patient.id, id)

    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "invoice",
      entityId: id,
      after: {
        number,
        kind: input.kind,
        lineCount: lines.length,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
      },
    })
    return { id, number }
  })
}

/**
 * Voids an issued invoice: it stays on record (marked void, with the reason), its journal
 * entry is reversed, and its plan items can be billed again.
 */
export async function voidInvoice(
  actor: CurrentUser,
  input: z.output<typeof voidInvoiceSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day, at } = await clockOf(tx, clock)
    const invoice = await tx.invoice.findUnique({
      where: { id: input.id },
      select: { number: true, status: true, journalEntryId: true, total: true, patientId: true },
    })
    if (!invoice) throw new AppError("not_found")
    await lockPatient(tx, invoice.patientId)

    // Conditional update: two people voiding at once can't both succeed.
    const voided = await tx.invoice.updateMany({
      where: { id: input.id, status: "issued" },
      data: {
        status: "void",
        voidedAt: at,
        voidedById: actor.id,
        voidReason: input.reason,
      },
    })
    if (voided.count === 0) throw new AppError("conflict", "alreadyVoid")

    if (invoice.journalEntryId) {
      await reverseJournal(tx, invoice.journalEntryId, {
        date: day,
        description: invoice.number,
        userId: actor.id,
      })
    }
    await tx.treatmentPlanItem.updateMany({
      where: { invoiceId: input.id },
      data: { invoiceId: null },
    })
    // What was paid on it is credit again, applied to the patient's other open invoices.
    await settle(tx, invoice.patientId)
    await recordAudit(tx, {
      userId: actor.id,
      action: "void",
      entity: "invoice",
      entityId: input.id,
      before: { status: invoice.status, total: invoice.total },
      after: { status: "void", reason: input.reason },
    })
    return { number: invoice.number }
  })
}

/**
 * Records money received: the payment, its journal entry, and its allocation (the
 * chosen invoice first, then the oldest due; the rest stays as the patient's credit).
 * Submitting the same form twice returns the first payment.
 */
export async function recordPayment(
  actor: CurrentUser,
  input: z.output<typeof recordPaymentSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    await lockPatient(tx, input.patientId)
    const existing = await tx.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, number: true, patientId: true },
    })
    if (existing) {
      if (existing.patientId !== input.patientId) throw new AppError("validation")
      return { id: existing.id, number: existing.number }
    }

    const invoiceId = input.invoiceId || null
    if (invoiceId) {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, patientId: input.patientId, status: "issued" },
        select: { id: true },
      })
      if (!invoice) throw new AppError("not_found")
    }

    const { day: today } = await clockOf(tx, clock)
    const id = crypto.randomUUID()
    const number = documentNumber("RC", today, await nextNumber(tx, "receipt_number_seq"))
    const entry = await postJournal(tx, {
      date: today,
      description: number,
      source: { type: "payment", id },
      lines: paymentPosting(input.method, input.amount),
      userId: actor.id,
    })
    await tx.payment.create({
      data: {
        id,
        number,
        patientId: input.patientId,
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        receivedOn: new Date(`${today}T00:00:00Z`),
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        journalEntryId: entry.id,
        receivedById: actor.id,
      },
    })
    const allocations = await settle(tx, input.patientId, invoiceId)

    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "payment",
      entityId: id,
      after: {
        number,
        method: input.method,
        amount: input.amount,
        allocations: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })),
      },
    })
    return { id, number }
  })
}

/**
 * Voids a payment entered by mistake: it stays on record (marked void, with the reason),
 * its journal entry is reversed and its allocations stop counting.
 */
export async function voidPayment(
  actor: CurrentUser,
  input: z.output<typeof voidPaymentSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day, at } = await clockOf(tx, clock)
    const payment = await tx.payment.findUnique({
      where: { id: input.id },
      select: { number: true, patientId: true, amount: true, journalEntryId: true },
    })
    if (!payment) throw new AppError("not_found")
    await lockPatient(tx, payment.patientId)

    const voided = await tx.payment.updateMany({
      where: { id: input.id, voidedAt: null },
      data: { voidedAt: at, voidedById: actor.id, voidReason: input.reason },
    })
    if (voided.count === 0) throw new AppError("conflict", "alreadyVoid")
    if (payment.journalEntryId) {
      await reverseJournal(tx, payment.journalEntryId, {
        date: day,
        description: payment.number,
        userId: actor.id,
      })
    }
    // Other credit the patient has may now cover what this payment no longer does.
    await settle(tx, payment.patientId)
    await recordAudit(tx, {
      userId: actor.id,
      action: "void",
      entity: "payment",
      entityId: input.id,
      before: { amount: payment.amount },
      after: { reason: input.reason },
    })
    return { number: payment.number }
  })
}

/** Gives money back to a patient, out of their credit only. */
export async function refundPatient(
  actor: CurrentUser,
  input: z.output<typeof refundSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    await lockPatient(tx, input.patientId)
    const payments = await tx.payment.findMany({
      where: { patientId: input.patientId, voidedAt: null },
      select: {
        id: true,
        amount: true,
        allocations: { where: { invoice: { status: "issued" } }, select: { amount: true } },
      },
    })
    const refunds = await tx.refund.findMany({
      where: { patientId: input.patientId },
      select: { amount: true },
    })
    const credit = unappliedMoney(
      payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        applied: sumAmounts(p.allocations.map((a) => a.amount)),
      })),
      sumAmounts(refunds.map((r) => r.amount)),
    ).reduce((total, m) => total + m.amount, 0n)
    if (toMinor(input.amount) > credit) {
      throw new AppError("validation", "refundTooLarge", { amount: ["refundTooLarge"] })
    }

    const { day: today } = await clockOf(tx, clock)
    const id = crypto.randomUUID()
    const number = documentNumber("RF", today, await nextNumber(tx, "refund_number_seq"))
    const entry = await postJournal(tx, {
      date: today,
      description: number,
      source: { type: "refund", id },
      lines: refundPosting(input.method, input.amount),
      userId: actor.id,
    })
    await tx.refund.create({
      data: {
        id,
        number,
        patientId: input.patientId,
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        refundedOn: new Date(`${today}T00:00:00Z`),
        reason: input.reason,
        journalEntryId: entry.id,
        refundedById: actor.id,
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "refund",
      entityId: id,
      after: { number, method: input.method, amount: input.amount, reason: input.reason },
    })
    return { id, number }
  })
}

/**
 * Logs a payment reminder (the WhatsApp message itself is sent from the user's phone).
 * The amount is what the patient owes now, worked out here, not sent by the browser.
 */
export async function logPaymentReminder(
  actor: CurrentUser,
  input: z.output<typeof paymentReminderSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    await lockPatient(tx, input.patientId)
    const invoiced = await tx.invoice.aggregate({
      where: { patientId: input.patientId, status: "issued" },
      _sum: { total: true },
    })
    const paid = await tx.payment.aggregate({
      where: { patientId: input.patientId, voidedAt: null },
      _sum: { amount: true },
    })
    const refunded = await tx.refund.aggregate({
      where: { patientId: input.patientId },
      _sum: { amount: true },
    })
    const owed =
      toMinor(invoiced._sum.total?.toString() ?? "0") -
      toMinor(paid._sum.amount?.toString() ?? "0") +
      toMinor(refunded._sum.amount?.toString() ?? "0")
    if (owed <= 0n) throw new AppError("conflict", "nothingOwed")

    const reminder = await tx.paymentReminder.create({
      data: {
        patientId: input.patientId,
        amount: fromMinor(owed),
        sentById: actor.id,
        ...(clock && { sentAt: clock.at }),
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "payment_reminder",
      entityId: reminder.id,
      after: { patientId: input.patientId, amount: fromMinor(owed), channel: "whatsapp" },
    })
    return reminder
  })
}

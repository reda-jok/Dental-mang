import "server-only"

import type { z } from "zod"

import { todayIso } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import { can } from "@/server/permissions"
import type { CurrentUser } from "@/server/session"

import { postJournal, reverseJournal } from "../ledger/service"
import { givesNewDiscount, invoiceNumber, invoicePosting, invoiceTotals } from "./rules"
import type { createInvoiceSchema, voidInvoiceSchema } from "./schemas"

async function clinicToday(tx: Db) {
  const settings = await tx.clinicSettings.findUnique({
    where: { id: 1 },
    select: { timezone: true },
  })
  return todayIso(settings?.timezone)
}

/**
 * Issues an invoice. Prices come from the treatment plan or the catalog (never from the
 * browser). In one transaction: the invoice and its lines, the journal entry, the plan
 * items marked as billed, and the audit entry.
 */
export async function createInvoice(
  actor: CurrentUser,
  input: z.output<typeof createInvoiceSchema>,
) {
  return db.$transaction(async (tx) => {
    const today = await clinicToday(tx)
    if (input.dueDate < today) {
      throw new AppError("validation", "dueBeforeIssue", { dueDate: ["dueBeforeIssue"] })
    }

    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")

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
export async function voidInvoice(actor: CurrentUser, input: z.output<typeof voidInvoiceSchema>) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.id },
      select: { number: true, status: true, journalEntryId: true, total: true },
    })
    if (!invoice) throw new AppError("not_found")

    // Conditional update: two people voiding at once can't both succeed.
    const voided = await tx.invoice.updateMany({
      where: { id: input.id, status: "issued" },
      data: {
        status: "void",
        voidedAt: new Date(),
        voidedById: actor.id,
        voidReason: input.reason,
      },
    })
    if (voided.count === 0) throw new AppError("conflict", "alreadyVoid")

    if (invoice.journalEntryId) {
      await reverseJournal(tx, invoice.journalEntryId, {
        date: await clinicToday(tx),
        description: invoice.number,
        userId: actor.id,
      })
    }
    await tx.treatmentPlanItem.updateMany({
      where: { invoiceId: input.id },
      data: { invoiceId: null },
    })
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

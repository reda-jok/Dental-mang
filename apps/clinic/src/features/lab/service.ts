import "server-only"

import type { z } from "zod"

import { toMinor } from "@/lib/money"
import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { clockOf, type Clock } from "../billing/service"
import { postJournal, reverseJournal } from "../ledger/service"
import { labAdjustmentPosting, labBillPosting, labPaymentPosting } from "./money"
import { canDo, type LabStatus } from "./rules"
import type {
  archiveLabSchema,
  createLabCaseSchema,
  createLabSchema,
  labAdjustmentSchema,
  labCaseStepSchema,
  labPaymentSchema,
  updateLabCaseSchema,
  updateLabSchema,
  voidLabPaymentSchema,
} from "./schemas"

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

async function nextCaseNumber(tx: Db, sentOn: string) {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`select nextval('lab_case_number_seq') as n`
  return `LAB-${sentOn.slice(0, 4)}-${String(row!.n).padStart(6, "0")}`
}

export async function createLabCase(
  actor: CurrentUser,
  input: z.output<typeof createLabCaseSchema>,
) {
  return db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")
    const lab = await tx.lab.findFirst({
      where: { id: input.labId, archivedAt: null },
      select: { id: true },
    })
    if (!lab) throw new AppError("validation", "labMissing", { labId: ["required"] })
    if (input.planItemId) {
      const item = await tx.treatmentPlanItem.findFirst({
        where: { id: input.planItemId, plan: { patientId: patient.id } },
        select: { id: true },
      })
      if (!item) throw new AppError("not_found")
      const open = await tx.labCase.count({
        where: { planItemId: item.id, status: { in: ["sent", "received"] } },
      })
      if (open > 0) throw new AppError("conflict", "labCaseOpen")
    }

    const number = await nextCaseNumber(tx, input.sentOn)
    const created = await tx.labCase.create({
      data: {
        number,
        patientId: patient.id,
        labId: lab.id,
        dentistId: input.dentistId || (actor.role === "dentist" ? actor.id : null),
        planItemId: input.planItemId || null,
        work: input.work,
        teeth: input.teeth,
        shade: input.shade,
        material: input.material,
        instructions: input.instructions,
        cost: input.cost,
        sentOn: asDate(input.sentOn),
        dueOn: asDate(input.dueOn),
        createdById: actor.id,
      },
      select: { id: true, number: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "lab_case",
      entityId: created.id,
      after: { ...input, number },
    })
    return created
  })
}

/**
 * Details can be corrected while the work is at the lab. Once billed (it came back at
 * least once), the lab and the cost stay as billed; a correction is a lab adjustment.
 */
export async function updateLabCase(
  actor: CurrentUser,
  { id, ...input }: z.output<typeof updateLabCaseSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.labCase.findUnique({ where: { id } })
    if (!before) throw new AppError("not_found")
    if (before.status !== "sent") throw new AppError("conflict", "labCaseNotEditable")
    if (
      before.billedOn &&
      (before.labId !== input.labId || toMinor(before.cost.toString()) !== toMinor(input.cost))
    ) {
      throw new AppError("conflict", "labCaseBilled")
    }
    await tx.labCase.update({
      where: { id },
      data: {
        labId: input.labId,
        dentistId: input.dentistId || null,
        work: input.work,
        teeth: input.teeth,
        shade: input.shade,
        material: input.material,
        instructions: input.instructions,
        cost: input.cost,
        sentOn: asDate(input.sentOn),
        dueOn: asDate(input.dueOn),
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "lab_case",
      entityId: id,
      before,
      after: input,
    })
  })
}

/**
 * Makes a case's cost the lab's bill: the journal entry (Dr lab expense, Cr payables)
 * and the case marked billed on `day`, in the caller's transaction. Only once per case.
 */
export async function billLabCase(
  tx: Db,
  input: { id: string; number: string; cost: string; day: string; userId: string | null },
) {
  const entry = await postJournal(tx, {
    date: input.day,
    description: input.number,
    source: { type: "lab_bill", id: input.id },
    lines: labBillPosting(input.cost, input.number),
    userId: input.userId,
  })
  const billed = await tx.labCase.updateMany({
    where: { id: input.id, billedOn: null },
    data: { cost: input.cost, billedOn: asDate(input.day), journalEntryId: entry.id },
  })
  if (billed.count === 0) throw new AppError("conflict", "labCaseBilled")
  return entry
}

/**
 * Moves a case on: received from the lab, fitted, sent back to be redone, or cancelled.
 * The first time the work comes back, its cost becomes the lab's bill (journal entry in
 * the same transaction). A remake isn't billed again, and a cancelled case keeps its bill
 * (the lab did the work); the lab can take it off with a discount.
 */
export async function stepLabCase(actor: CurrentUser, step: z.output<typeof labCaseStepSchema>) {
  return db.$transaction(async (tx) => {
    const current = await tx.labCase.findUnique({
      where: { id: step.id },
      select: {
        number: true,
        status: true,
        sentOn: true,
        receivedOn: true,
        remakes: true,
        billedOn: true,
      },
    })
    if (!current) throw new AppError("not_found")
    if (!canDo(current.status as LabStatus, step.action)) {
      throw new AppError("conflict", "statusChangeNotAllowed")
    }
    if (step.action === "receive" || step.action === "fit") {
      const { day: today } = await clockOf(tx)
      if (step.date > today) {
        throw new AppError("validation", "dateInFuture", { date: ["dateInFuture"] })
      }
    }
    if (step.action === "receive" && asDate(step.date) < current.sentOn) {
      throw new AppError("validation", "receivedBeforeSent", { date: ["receivedBeforeSent"] })
    }
    if (step.action === "fit" && current.receivedOn && asDate(step.date) < current.receivedOn) {
      throw new AppError("validation", "fittedBeforeReceived", { date: ["fittedBeforeReceived"] })
    }
    const data =
      step.action === "receive"
        ? {
            status: "received" as const,
            receivedOn: asDate(step.date),
            // The cost confirmed on the first return; it's locked once billed.
            ...(!current.billedOn && { cost: step.cost }),
          }
        : step.action === "fit"
          ? { status: "fitted" as const, fittedOn: asDate(step.date) }
          : step.action === "remake"
            ? {
                status: "sent" as const,
                receivedOn: null,
                dueOn: asDate(step.dueOn),
                remakes: current.remakes + 1,
              }
            : { status: "cancelled" as const, cancelReason: step.reason }
    // Conditional update: a second click on the same step finds the status changed.
    const moved = await tx.labCase.updateMany({
      where: { id: step.id, status: current.status },
      data,
    })
    if (moved.count === 0) throw new AppError("conflict", "statusChangeNotAllowed")
    const bill =
      step.action === "receive" && !current.billedOn && toMinor(step.cost) > 0n
        ? await billLabCase(tx, {
            id: step.id,
            number: current.number,
            cost: step.cost,
            day: step.date,
            userId: actor.id,
          })
        : null
    await recordAudit(tx, {
      userId: actor.id,
      action: step.action === "cancel" ? "void" : "update",
      entity: "lab_case",
      entityId: step.id,
      before: { status: current.status },
      after: { ...step, ...(bill && { journalEntry: bill.number }) },
    })
    return { status: data.status }
  })
}

/** Locks the lab row so its payments are recorded one at a time. */
async function lockLab(tx: Db, labId: string) {
  const rows = await tx.$queryRaw<{ name: string }[]>`
    select name from lab where id = ${labId}::uuid for update`
  if (rows.length === 0) throw new AppError("not_found")
  return rows[0]!
}

/**
 * Money paid to a lab: the payment and its journal entry. Cash comes out of the drawer
 * and is counted in the next daily close. Submitting the same form twice returns the
 * first payment. Paying more than is owed leaves credit with the lab.
 */
export async function recordLabPayment(
  actor: CurrentUser,
  input: z.output<typeof labPaymentSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const lab = await lockLab(tx, input.labId)
    const existing = await tx.labPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, number: true, labId: true },
    })
    if (existing) {
      if (existing.labId !== input.labId) throw new AppError("validation")
      return { id: existing.id, number: existing.number }
    }

    const { day } = await clockOf(tx, clock)
    const [row] = await tx.$queryRaw<{ n: bigint }[]>`select nextval('lab_payment_number_seq') as n`
    const number = `LP-${day.slice(0, 4)}-${String(row!.n).padStart(6, "0")}`
    const id = crypto.randomUUID()
    const entry = await postJournal(tx, {
      date: day,
      description: `${number} · ${lab.name}`,
      source: { type: "lab_payment", id },
      lines: labPaymentPosting(input.method, input.amount),
      userId: actor.id,
    })
    await tx.labPayment.create({
      data: {
        id,
        number,
        labId: input.labId,
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        paidOn: asDate(day),
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        journalEntryId: entry.id,
        paidById: actor.id,
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "lab_payment",
      entityId: id,
      after: { number, labId: input.labId, method: input.method, amount: input.amount },
    })
    return { id, number }
  })
}

/** Voids a lab payment entered by mistake: kept on record, its journal entry reversed. */
export async function voidLabPayment(
  actor: CurrentUser,
  input: z.output<typeof voidLabPaymentSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day, at } = await clockOf(tx, clock)
    const payment = await tx.labPayment.findUnique({
      where: { id: input.id },
      select: { number: true, amount: true, journalEntryId: true },
    })
    if (!payment) throw new AppError("not_found")
    const voided = await tx.labPayment.updateMany({
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
    await recordAudit(tx, {
      userId: actor.id,
      action: "void",
      entity: "lab_payment",
      entityId: input.id,
      before: { amount: payment.amount },
      after: { reason: input.reason },
    })
    return { number: payment.number }
  })
}

/**
 * A discount the lab gives (the clinic owes less) or an extra charge not tied to a case.
 * Append-only: a mistake is fixed with an opposite adjustment.
 */
export async function addLabAdjustment(
  actor: CurrentUser,
  input: z.output<typeof labAdjustmentSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const lab = await lockLab(tx, input.labId)
    const { day } = await clockOf(tx, clock)
    const id = crypto.randomUUID()
    const entry = await postJournal(tx, {
      date: day,
      description: `${lab.name}: ${input.reason}`,
      source: { type: "lab_adjustment", id },
      lines: labAdjustmentPosting(input.kind, input.amount),
      userId: actor.id,
    })
    await tx.labAdjustment.create({
      data: {
        id,
        labId: input.labId,
        kind: input.kind,
        amount: input.amount,
        madeOn: asDate(day),
        reason: input.reason,
        journalEntryId: entry.id,
        createdById: actor.id,
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "lab_adjustment",
      entityId: id,
      after: input,
    })
    return { id }
  })
}

export async function createLab(actor: CurrentUser, input: z.output<typeof createLabSchema>) {
  return db.$transaction(async (tx) => {
    const lab = await tx.lab.create({ data: input, select: { id: true } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "lab",
      entityId: lab.id,
      after: input,
    })
    return lab
  })
}

export async function updateLab(
  actor: CurrentUser,
  { id, ...input }: z.output<typeof updateLabSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.lab.findUnique({ where: { id } })
    if (!before) throw new AppError("not_found")
    await tx.lab.update({ where: { id }, data: input })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "lab",
      entityId: id,
      before,
      after: input,
    })
  })
}

export async function archiveLab(actor: CurrentUser, { id }: z.output<typeof archiveLabSchema>) {
  await db.$transaction(async (tx) => {
    const open = await tx.labCase.count({
      where: { labId: id, status: { in: ["sent", "received"] } },
    })
    if (open > 0) throw new AppError("conflict", "labHasOpenCases")
    const archived = await tx.lab.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    })
    if (archived.count === 0) throw new AppError("not_found")
    await recordAudit(tx, { userId: actor.id, action: "delete", entity: "lab", entityId: id })
  })
}

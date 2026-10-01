import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { canDo, type LabStatus } from "./rules"
import type {
  archiveLabSchema,
  createLabCaseSchema,
  createLabSchema,
  labCaseStepSchema,
  updateLabCaseSchema,
  updateLabSchema,
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

/** Details can be corrected while the work is still at the lab. */
export async function updateLabCase(
  actor: CurrentUser,
  { id, ...input }: z.output<typeof updateLabCaseSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.labCase.findUnique({ where: { id } })
    if (!before) throw new AppError("not_found")
    if (before.status !== "sent") throw new AppError("conflict", "labCaseNotEditable")
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

/** Moves a case on: received from the lab, fitted, sent back to be redone, or cancelled. */
export async function stepLabCase(actor: CurrentUser, step: z.output<typeof labCaseStepSchema>) {
  return db.$transaction(async (tx) => {
    const current = await tx.labCase.findUnique({
      where: { id: step.id },
      select: { status: true, sentOn: true, receivedOn: true, remakes: true },
    })
    if (!current) throw new AppError("not_found")
    if (!canDo(current.status as LabStatus, step.action)) {
      throw new AppError("conflict", "statusChangeNotAllowed")
    }
    const data =
      step.action === "receive"
        ? { status: "received" as const, receivedOn: asDate(step.date) }
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
    if (step.action === "receive" && asDate(step.date) < current.sentOn) {
      throw new AppError("validation", "receivedBeforeSent", { date: ["receivedBeforeSent"] })
    }
    if (step.action === "fit" && current.receivedOn && asDate(step.date) < current.receivedOn) {
      throw new AppError("validation", "fittedBeforeReceived", { date: ["fittedBeforeReceived"] })
    }
    // Conditional update: a second click on the same step finds the status changed.
    const moved = await tx.labCase.updateMany({
      where: { id: step.id, status: current.status },
      data,
    })
    if (moved.count === 0) throw new AppError("conflict", "statusChangeNotAllowed")
    await recordAudit(tx, {
      userId: actor.id,
      action: step.action === "cancel" ? "void" : "update",
      entity: "lab_case",
      entityId: step.id,
      before: { status: current.status },
      after: { ...step },
    })
    return { status: data.status }
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

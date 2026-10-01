import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import {
  canChangeItemStatus,
  canChangePlanStatus,
  isPlanOpen,
  planItemTargets,
  shouldCompletePlan,
} from "./rules"
import type {
  addPlanItemsSchema,
  createPlanSchema,
  setItemStatusSchema,
  setPlanStatusSchema,
} from "./schemas"

export async function createPlan(actor: CurrentUser, input: z.output<typeof createPlanSchema>) {
  return db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")
    const plan = await tx.treatmentPlan.create({
      data: { ...input, createdById: actor.id },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "treatment_plan",
      entityId: plan.id,
      after: input,
    })
    return plan
  })
}

/** Adds one item per selected tooth, priced from the catalog at this moment. */
export async function addPlanItems(actor: CurrentUser, input: z.output<typeof addPlanItemsSchema>) {
  return db.$transaction(async (tx) => {
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: input.planId },
      select: { status: true, patientId: true },
    })
    if (!plan) throw new AppError("not_found")
    if (!isPlanOpen(plan.status)) throw new AppError("conflict", "planClosed")

    const procedure = await tx.procedure.findFirst({
      where: { id: input.procedureId, archivedAt: null },
      select: { name: true, price: true, currency: true, toothScope: true },
    })
    if (!procedure)
      throw new AppError("validation", "procedureMissing", { procedureId: ["required"] })

    const result = planItemTargets(procedure.toothScope, input.teeth, input.surfaces)
    if (!result.ok) throw new AppError("validation", result.error)

    await tx.treatmentPlanItem.createMany({
      data: result.targets.map((target) => ({
        planId: input.planId,
        procedureId: input.procedureId,
        tooth: target.tooth,
        surfaces: target.surfaces,
        phase: input.phase,
        price: procedure.price,
        currency: procedure.currency,
        notes: input.notes,
        dentistId: actor.role === "dentist" ? actor.id : null,
      })),
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "treatment_plan_item",
      entityId: input.planId,
      after: {
        procedure: procedure.name,
        targets: result.targets,
        price: procedure.price.toString(),
        currency: procedure.currency,
        phase: input.phase,
      },
    })
    return { patientId: plan.patientId, count: result.targets.length }
  })
}

export async function setItemStatus(
  actor: CurrentUser,
  input: z.output<typeof setItemStatusSchema>,
) {
  return db.$transaction(async (tx) => {
    const item = await tx.treatmentPlanItem.findUnique({
      where: { id: input.itemId },
      select: {
        status: true,
        planId: true,
        invoiceId: true,
        plan: { select: { status: true, patientId: true } },
      },
    })
    if (!item) throw new AppError("not_found")
    if (!isPlanOpen(item.plan.status)) throw new AppError("conflict", "planClosed")
    if (!canChangeItemStatus(item.status, input.status))
      throw new AppError("conflict", "statusChangeNotAllowed")
    // A billed treatment stays on its invoice; void the invoice first to cancel it.
    if (input.status === "cancelled" && item.invoiceId) throw new AppError("conflict", "itemBilled")

    await tx.treatmentPlanItem.update({
      where: { id: input.itemId },
      data: {
        status: input.status,
        completedAt: input.status === "done" ? new Date() : null,
        // Whoever marks the work done is recorded as the treating dentist (if a dentist).
        ...(input.status === "done" && actor.role === "dentist" && { dentistId: actor.id }),
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "treatment_plan_item",
      entityId: input.itemId,
      before: { status: item.status },
      after: { status: input.status },
    })

    const siblings = await tx.treatmentPlanItem.findMany({
      where: { planId: item.planId },
      select: { status: true },
    })
    if (shouldCompletePlan(siblings)) {
      await tx.treatmentPlan.update({ where: { id: item.planId }, data: { status: "completed" } })
      await recordAudit(tx, {
        userId: actor.id,
        action: "update",
        entity: "treatment_plan",
        entityId: item.planId,
        after: { status: "completed", automatic: true },
      })
    }
    return { patientId: item.plan.patientId }
  })
}

export async function setPlanStatus(
  actor: CurrentUser,
  input: z.output<typeof setPlanStatusSchema>,
) {
  return db.$transaction(async (tx) => {
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: input.planId },
      select: {
        status: true,
        patientId: true,
        _count: { select: { items: { where: { invoiceId: { not: null } } } } },
      },
    })
    if (!plan) throw new AppError("not_found")
    if (!canChangePlanStatus(plan.status, input.status))
      throw new AppError("conflict", "statusChangeNotAllowed")
    if (input.status === "cancelled" && plan._count.items > 0)
      throw new AppError("conflict", "planBilled")
    await tx.treatmentPlan.update({
      where: { id: input.planId },
      data: {
        status: input.status,
        acceptedAt: input.status === "accepted" ? new Date() : undefined,
      },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "treatment_plan",
      entityId: input.planId,
      before: { status: plan.status },
      after: { status: input.status },
    })
    return { patientId: plan.patientId }
  })
}

import "server-only"

import { randomUUID } from "node:crypto"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type {
  addFindingSchema,
  createConditionSchema,
  setConditionHiddenSchema,
  updateConditionSchema,
} from "./schemas"
import { normalizeSurfaces } from "./teeth"

/**
 * A condition that can be chosen now: it exists and isn't hidden (`keep` allows the one a
 * record already has, so editing it doesn't fail once the condition is hidden).
 */
export async function usableCondition(tx: Db, code: string, keep?: string | null) {
  const condition = await tx.toothCondition.findUnique({
    where: { code },
    select: { scope: true, hiddenAt: true },
  })
  if (!condition || (condition.hiddenAt && code !== keep)) {
    throw new AppError("validation", "conditionUnavailable")
  }
  return condition
}

/** One finding per selected tooth; whole-tooth conditions ignore surfaces. */
export async function addFindings(actor: CurrentUser, input: z.output<typeof addFindingSchema>) {
  return db.$transaction(async (tx) => {
    const condition = await usableCondition(tx, input.condition)
    const surfaces = condition.scope === "tooth" ? [] : normalizeSurfaces(input.surfaces)
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")
    const teeth = [...new Set(input.teeth)]
    const created = await tx.toothFinding.createManyAndReturn({
      select: { id: true },
      data: teeth.map((tooth) => ({
        patientId: input.patientId,
        tooth,
        surfaces,
        condition: input.condition,
        notes: input.notes,
        recordedById: actor.id,
      })),
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "tooth_finding",
      entityId: input.patientId,
      after: { teeth, surfaces, condition: input.condition, notes: input.notes },
    })
    return created.map((f) => f.id)
  })
}

/** A finding that no longer applies stays in history, marked resolved. */
export async function resolveFinding(actor: CurrentUser, id: string) {
  return db.$transaction(async (tx) => {
    const finding = await tx.toothFinding.findFirst({
      where: { id, resolvedAt: null },
      select: { patientId: true },
    })
    if (!finding) throw new AppError("not_found")
    await tx.toothFinding.update({ where: { id }, data: { resolvedAt: new Date() } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "tooth_finding",
      entityId: id,
      after: { resolved: true },
    })
    return finding
  })
}

export async function createCondition(
  actor: CurrentUser,
  input: z.output<typeof createConditionSchema>,
) {
  return db.$transaction(async (tx) => {
    const last = await tx.toothCondition.aggregate({ _max: { sortOrder: true } })
    const condition = await tx.toothCondition.create({
      data: { ...input, code: randomUUID(), sortOrder: (last._max.sortOrder ?? 0) + 1 },
      select: { code: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "tooth_condition",
      entityId: condition.code,
      after: input,
    })
    return condition
  })
}

/** Name and colour; a built-in condition with no name goes back to its usual one. */
export async function updateCondition(
  actor: CurrentUser,
  { code, ...input }: z.output<typeof updateConditionSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.toothCondition.findUnique({
      where: { code },
      select: { name: true, color: true, builtIn: true },
    })
    if (!before) throw new AppError("not_found")
    if (!before.builtIn && !input.name) {
      throw new AppError("validation", undefined, { name: ["required"] })
    }
    await tx.toothCondition.update({ where: { code }, data: input })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "tooth_condition",
      entityId: code,
      before: { name: before.name, color: before.color },
      after: input,
    })
  })
}

/** Hidden conditions aren't offered any more; teeth that have one keep showing it. */
export async function setConditionHidden(
  actor: CurrentUser,
  { code, hidden }: z.output<typeof setConditionHiddenSchema>,
) {
  await db.$transaction(async (tx) => {
    const updated = await tx.toothCondition.updateMany({
      where: { code, hiddenAt: hidden ? null : { not: null } },
      data: { hiddenAt: hidden ? new Date() : null },
    })
    if (updated.count === 0) throw new AppError("not_found")
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "tooth_condition",
      entityId: code,
      after: { hidden },
    })
  })
}

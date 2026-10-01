import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { addFindingSchema } from "./schemas"
import { conditionInfo, normalizeSurfaces } from "./teeth"

/** One finding per selected tooth; whole-tooth conditions ignore surfaces. */
export async function addFindings(actor: CurrentUser, input: z.output<typeof addFindingSchema>) {
  const surfaces =
    conditionInfo(input.condition)?.scope === "tooth" ? [] : normalizeSurfaces(input.surfaces)
  await db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")
    const teeth = [...new Set(input.teeth)]
    await tx.toothFinding.createMany({
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

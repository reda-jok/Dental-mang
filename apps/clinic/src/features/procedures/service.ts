import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { categorySchema, createProcedureSchema, updateProcedureSchema } from "./schemas"
import { STARTER_CATALOG } from "./starter"

export async function createCategory(actor: CurrentUser, input: z.output<typeof categorySchema>) {
  const existing = await db.procedureCategory.findUnique({ where: { name: input.name } })
  if (existing) throw new AppError("conflict", "categoryExists", { name: ["categoryExists"] })
  return db.$transaction(async (tx) => {
    const count = await tx.procedureCategory.count()
    const category = await tx.procedureCategory.create({
      data: { name: input.name, sortOrder: count },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "procedure_category",
      entityId: category.id,
      after: input,
    })
    return category
  })
}

async function assertCategory(categoryId: string) {
  const category = await db.procedureCategory.findFirst({
    where: { id: categoryId, archivedAt: null },
  })
  if (!category) throw new AppError("validation", "categoryMissing", { categoryId: ["required"] })
}

export async function createProcedure(
  actor: CurrentUser,
  input: z.output<typeof createProcedureSchema>,
) {
  await assertCategory(input.categoryId)
  return db.$transaction(async (tx) => {
    const procedure = await tx.procedure.create({
      data: { ...input, createdById: actor.id },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "procedure",
      entityId: procedure.id,
      after: input,
    })
    return procedure
  })
}

/** Price changes apply to new plan items only; existing plans keep the price they were given. */
export async function updateProcedure(
  actor: CurrentUser,
  input: z.output<typeof updateProcedureSchema>,
) {
  await assertCategory(input.categoryId)
  const { id, ...data } = input
  await db.$transaction(async (tx) => {
    const before = await tx.procedure.findFirst({ where: { id, archivedAt: null } })
    if (!before) throw new AppError("not_found")
    await tx.procedure.update({ where: { id }, data })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "procedure",
      entityId: id,
      before: { ...before, price: before.price.toString() },
      after: data,
    })
  })
}

/** Archived procedures disappear from the catalog but stay on existing plans. */
export async function archiveProcedure(actor: CurrentUser, id: string) {
  await db.$transaction(async (tx) => {
    const updated = await tx.procedure.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    })
    if (updated.count === 0) throw new AppError("not_found")
    await recordAudit(tx, { userId: actor.id, action: "delete", entity: "procedure", entityId: id })
  })
}

/** One-click starter list for an empty catalog (prices at 0 for the clinic to set). */
export async function loadStarterCatalog(actor: CurrentUser) {
  await db.$transaction(async (tx) => {
    if ((await tx.procedure.count()) > 0) throw new AppError("conflict", "catalogNotEmpty")
    for (const [index, group] of STARTER_CATALOG.entries()) {
      const category = await tx.procedureCategory.upsert({
        where: { name: group.category },
        create: { name: group.category, sortOrder: index },
        update: {},
      })
      await tx.procedure.createMany({
        data: group.procedures.map((p) => ({
          ...p,
          categoryId: category.id,
          price: "0",
          currency: "IQD" as const,
          createdById: actor.id,
        })),
      })
    }
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "procedure_catalog",
      after: { starter: true },
    })
  })
}

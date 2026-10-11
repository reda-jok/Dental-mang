import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import type { CurrentUser } from "@/server/session"

import type { saveLayoutSchema, saveRoleLayoutSchema } from "./schemas"

/** A user's own dashboard layout (any signed-in user, for themselves only). */
export async function saveOwnLayout(actor: CurrentUser, input: z.output<typeof saveLayoutSchema>) {
  await db.$transaction(async (tx) => {
    await tx.dashboardLayout.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, widgets: input.widgets },
      update: { widgets: input.widgets },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "dashboard_layout",
      entityId: actor.id,
      after: input.widgets,
    })
  })
}

/** Back to the role's default (or the standard order). */
export async function resetOwnLayout(actor: CurrentUser) {
  await db.$transaction(async (tx) => {
    await tx.dashboardLayout.deleteMany({ where: { userId: actor.id } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "delete",
      entity: "dashboard_layout",
      entityId: actor.id,
    })
  })
}

/** The owner's default layout for a role; users of that role who saved their own keep it. */
export async function saveRoleLayout(
  actor: CurrentUser,
  input: z.output<typeof saveRoleLayoutSchema>,
) {
  await db.$transaction(async (tx) => {
    await tx.dashboardLayout.upsert({
      where: { role: input.role },
      create: { role: input.role, widgets: input.widgets },
      update: { widgets: input.widgets },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "dashboard_layout_default",
      after: input,
    })
  })
}

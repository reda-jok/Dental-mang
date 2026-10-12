import "server-only"

import type { z } from "zod"

import {
  ADJUSTABLE_PERMISSIONS,
  defaultHasPermission,
  isRoleName,
  resolvePermission,
} from "@/lib/permissions"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { setRolePermissionSchema } from "./schemas"

/**
 * Grants or removes an adjustable permission for a role. Only differences from the
 * code default are stored, so a setting back at its default leaves no row. A role must
 * have the permission's prerequisites first (the screen locks those switches too).
 */
export async function setRolePermission(
  actor: CurrentUser,
  { role, permission, granted }: z.output<typeof setRolePermissionSchema>,
) {
  if (!isRoleName(role) || role === "owner")
    throw new AppError("validation", "permissionNotEligible")
  const isDefault = defaultHasPermission(role, permission) === granted
  const key = { role_permission: { role, permission } }

  await db.$transaction(async (tx) => {
    const overrides = await tx.rolePermission.findMany({
      where: { role },
      select: { role: true, permission: true, granted: true },
    })
    const { requires } = ADJUSTABLE_PERMISSIONS.find((p) => p.permission === permission)!
    if (!requires.every((r) => resolvePermission(role, r, overrides))) {
      throw new AppError("validation", "permissionNotEligible")
    }
    const before = overrides.find((o) => o.permission === permission)
    if (isDefault) {
      await tx.rolePermission.deleteMany({ where: { role, permission } })
    } else {
      await tx.rolePermission.upsert({
        where: key,
        create: { role, permission, granted, updatedById: actor.id },
        update: { granted, updatedById: actor.id },
      })
    }
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "role_permission",
      entityId: `${role}:${permission}`,
      before: { granted: before?.granted ?? defaultHasPermission(role, permission) },
      after: { granted },
    })
  })
}

import "server-only"

import type { z } from "zod"

import { defaultHasPermission, eligibleRoles, isRoleName } from "@/lib/permissions"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { setRolePermissionSchema } from "./schemas"

/**
 * Grants or removes an adjustable permission for a role. Only differences from the
 * code default are stored, so a setting back at its default leaves no row.
 */
export async function setRolePermission(
  actor: CurrentUser,
  { role, permission, granted }: z.output<typeof setRolePermissionSchema>,
) {
  if (!isRoleName(role) || !eligibleRoles(permission).includes(role)) {
    throw new AppError("validation", "permissionNotEligible")
  }
  const isDefault = defaultHasPermission(role, permission) === granted
  const key = { role_permission: { role, permission } }

  await db.$transaction(async (tx) => {
    const before = await tx.rolePermission.findUnique({ where: key, select: { granted: true } })
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

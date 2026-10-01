import "server-only"

import {
  ADJUSTABLE_PERMISSIONS,
  eligibleRoles,
  resolvePermission,
  type AdjustablePermission,
  type RoleName,
} from "@/lib/permissions"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export type PermissionSetting = {
  permission: AdjustablePermission
  roles: { role: RoleName; granted: boolean }[]
}

/** Every adjustable permission with its eligible roles and their current setting. */
export async function getPermissionSettings(): Promise<PermissionSetting[]> {
  await authorize("settings:permissions")
  const overrides = await db.rolePermission.findMany({
    select: { role: true, permission: true, granted: true },
  })
  return ADJUSTABLE_PERMISSIONS.map(({ permission }) => ({
    permission,
    roles: eligibleRoles(permission).map((role) => ({
      role,
      granted: resolvePermission(role, permission, overrides),
    })),
  }))
}

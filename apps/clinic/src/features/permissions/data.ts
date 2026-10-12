import "server-only"

import {
  ADJUSTABLE_PERMISSIONS,
  resolvePermission,
  ROLE_NAMES,
  type AdjustablePermission,
  type RoleName,
} from "@/lib/permissions"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export type PermissionSetting = {
  permission: AdjustablePermission
  requires: readonly AdjustablePermission[]
  /** `blocked`: the role lacks a prerequisite, so the switch is off and locked. */
  roles: { role: RoleName; granted: boolean; blocked: boolean }[]
}

/** Every adjustable permission with each role's current setting (the owner has them all). */
export async function getPermissionSettings(): Promise<PermissionSetting[]> {
  await authorize("settings:permissions")
  const overrides = await db.rolePermission.findMany({
    select: { role: true, permission: true, granted: true },
  })
  return ADJUSTABLE_PERMISSIONS.map(({ permission, requires }) => ({
    permission,
    requires,
    roles: ROLE_NAMES.filter((role) => role !== "owner").map((role) => ({
      role,
      granted: resolvePermission(role, permission, overrides),
      blocked: !requires.every((r) => resolvePermission(role, r, overrides)),
    })),
  }))
}

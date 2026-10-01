import "server-only"

import { cache } from "react"

import {
  isAdjustable,
  resolvePermission,
  type Permission,
  type PermissionOverride,
} from "@/lib/permissions"
import { db } from "@/server/db"

/** The owner's per-role overrides, read once per request. */
export const getPermissionOverrides = cache(async (): Promise<PermissionOverride[]> =>
  db.rolePermission.findMany({ select: { role: true, permission: true, granted: true } }),
)

/**
 * The effective permission for a role, including adjustable ones. Use this on the
 * server for anything in ADJUSTABLE_PERMISSIONS (discount, void).
 */
export async function can(user: { role: string }, permission: Permission): Promise<boolean> {
  const overrides = isAdjustable(permission) ? await getPermissionOverrides() : []
  return resolvePermission(user.role, permission, overrides)
}

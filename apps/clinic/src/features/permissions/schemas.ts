import { z } from "zod"

import { ADJUSTABLE_PERMISSIONS, ROLE_NAMES, type AdjustablePermission } from "@/lib/permissions"

export const setRolePermissionSchema = z.strictObject({
  role: z.enum(ROLE_NAMES as [string, ...string[]]),
  permission: z.enum(
    ADJUSTABLE_PERMISSIONS.map((p) => p.permission) as [
      AdjustablePermission,
      ...AdjustablePermission[],
    ],
  ),
  granted: z.boolean(),
})

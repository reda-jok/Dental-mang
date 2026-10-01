"use server"

import { revalidatePath } from "next/cache"

import { defineAction } from "@/server/action"

import { setRolePermissionSchema } from "./schemas"
import { setRolePermission } from "./service"

export const setRolePermissionAction = defineAction({
  schema: setRolePermissionSchema,
  permission: "settings:permissions",
  handler: async (input, { user }) => {
    await setRolePermission(user, input)
    revalidatePath("/settings/permissions")
    return null
  },
})

import "server-only"

import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"

import {
  hasPermission,
  isRoleName,
  permissionsFor,
  type Permission,
  type RoleName,
} from "@/lib/permissions"
import { auth } from "@/server/auth"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"

export type CurrentUser = {
  id: string
  name: string
  username: string | null
  role: RoleName
  /** The role's permissions with the owner's overrides applied; check with `hasPermission`. */
  permissions: Permission[]
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.banned) return null
  const { id, name, username, role } = session.user
  if (!isRoleName(role)) return null
  const overrides = await db.rolePermission.findMany({
    where: { role },
    select: { role: true, permission: true, granted: true },
  })
  return {
    id,
    name,
    username: username ?? null,
    role,
    permissions: permissionsFor(role, overrides),
  }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("unauthenticated")
  return user
}

/** Every data-layer function and service starts with this. */
export async function authorize(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser()
  if (!hasPermission(user, permission)) throw new AppError("forbidden")
  return user
}

/**
 * For pages and layouts: signed out → login page; lacking the permission → 404
 * (a page the user can't use shouldn't reveal that it exists).
 */
export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!hasPermission(user, permission)) notFound()
  return user
}

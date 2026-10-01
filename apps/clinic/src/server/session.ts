import "server-only"

import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"

import { isRoleName, type Permission, type RoleName } from "@/lib/permissions"
import { auth } from "@/server/auth"
import { AppError } from "@/server/errors"
import { can } from "@/server/permissions"

export type CurrentUser = {
  id: string
  name: string
  username: string | null
  role: RoleName
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.banned) return null
  const { id, name, username, role } = session.user
  if (!isRoleName(role)) return null
  return { id, name, username: username ?? null, role }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("unauthenticated")
  return user
}

/** Every data-layer function and service starts with this. */
export async function authorize(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser()
  if (!(await can(user, permission))) throw new AppError("forbidden")
  return user
}

/**
 * For pages and layouts: signed out → login page; lacking the permission → 404
 * (a page the user can't use shouldn't reveal that it exists).
 */
export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!(await can(user, permission))) notFound()
  return user
}

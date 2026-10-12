import "server-only"

import { isRoleName, type RoleName } from "@/lib/permissions"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export type StaffRow = {
  id: string
  name: string
  /** Empty for an employee who doesn't sign in. */
  username: string
  role: RoleName
  canSignIn: boolean
  active: boolean
  lastLoginAt: Date | null
}

export async function listStaff(): Promise<StaffRow[]> {
  await authorize("user:list")

  const users = await db.user.findMany({
    orderBy: [{ banned: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      banned: true,
      sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      accounts: { where: { providerId: "credential" }, take: 1, select: { id: true } },
    },
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: isRoleName(u.role) ? u.role : "reception",
    canSignIn: u.accounts.length > 0,
    active: !u.banned,
    lastLoginAt: u.sessions[0]?.createdAt ?? null,
  }))
}

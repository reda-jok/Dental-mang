import "server-only"

import { isRoleName, type RoleName } from "@/lib/permissions"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export type StaffRow = {
  id: string
  name: string
  username: string
  role: RoleName
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
    },
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    role: isRoleName(u.role) ? u.role : "reception",
    active: !u.banned,
    lastLoginAt: u.sessions[0]?.createdAt ?? null,
  }))
}

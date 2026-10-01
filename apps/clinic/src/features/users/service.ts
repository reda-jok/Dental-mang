import "server-only"

import type { z } from "zod"

import { isRoleName, type RoleName } from "@/lib/permissions"
import { recordAudit } from "@/server/audit"
import { auth, placeholderEmail } from "@/server/auth"
import { db, type Db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { checkUserChange, type Target, type UserChange } from "./policy"
import type {
  createUserSchema,
  resetPasswordSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "./schemas"

async function loadTarget(tx: Db, id: string): Promise<Target & { name: string }> {
  const user = await tx.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, banned: true },
  })
  if (!user || !isRoleName(user.role)) throw new AppError("not_found")
  return { id: user.id, name: user.name, role: user.role, active: !user.banned }
}

async function enforcePolicy(
  tx: Db,
  actor: CurrentUser,
  target: Target | null,
  change: UserChange,
) {
  const activeOwnerCount = await tx.user.count({
    where: { role: "owner", OR: [{ banned: false }, { banned: null }] },
  })
  const denial = checkUserChange(actor, target, change, activeOwnerCount)
  if (denial) throw new AppError("forbidden", denial)
}

export async function createStaff(actor: CurrentUser, input: z.output<typeof createUserSchema>) {
  const role = input.role as RoleName
  await enforcePolicy(db, actor, null, { kind: "create", role })

  const taken = await db.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  })
  if (taken) throw new AppError("conflict", "usernameTaken", { username: ["usernameTaken"] })

  // Better Auth hashes the password and creates the credential account.
  const { user } = await auth.api.createUser({
    body: {
      name: input.name,
      email: placeholderEmail(input.username),
      password: input.password,
      role,
      data: { username: input.username, displayUsername: input.username },
    },
  })

  await recordAudit(db, {
    userId: actor.id,
    action: "create",
    entity: "user",
    entityId: user.id,
    after: { name: input.name, username: input.username, role },
  })
  return { id: user.id }
}

export async function updateStaff(actor: CurrentUser, input: z.output<typeof updateUserSchema>) {
  const role = input.role as RoleName
  await db.$transaction(async (tx) => {
    const target = await loadTarget(tx, input.id)
    await enforcePolicy(tx, actor, target, { kind: "edit", role })

    await tx.user.update({ where: { id: input.id }, data: { name: input.name, role } })
    if (role !== target.role) {
      // New permissions take effect immediately: sign the user out everywhere.
      await tx.session.deleteMany({ where: { userId: input.id } })
    }
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "user",
      entityId: input.id,
      before: { name: target.name, role: target.role },
      after: { name: input.name, role },
    })
  })
}

export async function setStaffActive(
  actor: CurrentUser,
  input: z.output<typeof setUserActiveSchema>,
) {
  await db.$transaction(async (tx) => {
    const target = await loadTarget(tx, input.id)
    await enforcePolicy(tx, actor, target, { kind: input.active ? "enable" : "disable" })

    await tx.user.update({
      where: { id: input.id },
      data: input.active
        ? { banned: false, banReason: null, banExpires: null }
        : { banned: true, banReason: "disabled" },
    })
    if (!input.active) await tx.session.deleteMany({ where: { userId: input.id } })

    await recordAudit(tx, {
      userId: actor.id,
      action: input.active ? "enable" : "disable",
      entity: "user",
      entityId: input.id,
    })
  })
}

export async function resetStaffPassword(
  actor: CurrentUser,
  input: z.output<typeof resetPasswordSchema>,
) {
  const hash = await (await auth.$context).password.hash(input.password)

  await db.$transaction(async (tx) => {
    const target = await loadTarget(tx, input.id)
    await enforcePolicy(tx, actor, target, { kind: "resetPassword" })

    const updated = await tx.account.updateMany({
      where: { userId: input.id, providerId: "credential" },
      data: { password: hash },
    })
    if (updated.count === 0) throw new AppError("not_found")

    // Old sessions (possibly on a shared or stolen device) stop working.
    await tx.session.deleteMany({ where: { userId: input.id } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "password_reset",
      entity: "user",
      entityId: input.id,
    })
  })
}

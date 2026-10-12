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
  allowSignInSchema,
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

async function assertUsernameFree(tx: Db, username: string) {
  const taken = await tx.user.findUnique({ where: { username }, select: { id: true } })
  if (taken) throw new AppError("conflict", "usernameTaken", { username: ["usernameTaken"] })
}

/**
 * Adds an employee. One who signs in gets a username and password (Better Auth hashes it
 * and creates the credential account); one who doesn't gets neither, so can't sign in.
 */
export async function createStaff(actor: CurrentUser, input: z.output<typeof createUserSchema>) {
  const role = input.role as RoleName
  await enforcePolicy(db, actor, null, { kind: "create", role })
  if (input.canSignIn) await assertUsernameFree(db, input.username)

  const { user } = await auth.api.createUser({
    body: input.canSignIn
      ? {
          name: input.name,
          email: placeholderEmail(input.username),
          password: input.password,
          role,
          data: { username: input.username, displayUsername: input.username },
        }
      : { name: input.name, email: placeholderEmail(crypto.randomUUID()), role },
  })

  await recordAudit(db, {
    userId: actor.id,
    action: "create",
    entity: "user",
    entityId: user.id,
    after: {
      name: input.name,
      username: input.canSignIn ? input.username : null,
      role,
      canSignIn: input.canSignIn,
    },
  })
  return { id: user.id }
}

/** Gives an employee who couldn't sign in a username and password. */
export async function allowStaffSignIn(
  actor: CurrentUser,
  input: z.output<typeof allowSignInSchema>,
) {
  const hash = await (await auth.$context).password.hash(input.password)

  await db.$transaction(async (tx) => {
    const target = await loadTarget(tx, input.id)
    await enforcePolicy(tx, actor, target, { kind: "resetPassword" })
    const existing = await tx.account.findFirst({
      where: { userId: input.id, providerId: "credential" },
      select: { id: true },
    })
    if (existing) throw new AppError("conflict", "alreadyCanSignIn")
    await assertUsernameFree(tx, input.username)

    await tx.user.update({
      where: { id: input.id },
      data: { username: input.username, displayUsername: input.username },
    })
    await tx.account.create({
      data: { accountId: input.id, providerId: "credential", userId: input.id, password: hash },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "user",
      entityId: input.id,
      before: { canSignIn: false },
      after: { canSignIn: true, username: input.username },
    })
  })
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

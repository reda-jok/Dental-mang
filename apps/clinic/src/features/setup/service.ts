import "server-only"

import { connection } from "next/server"
import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { auth, placeholderEmail } from "@/server/auth"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"

import type { setupSchema } from "./schemas"

/** Setup is complete once the single ClinicSettings row exists. */
export async function isSetupComplete() {
  await connection() // request-time only; never query during build
  return (await db.clinicSettings.count()) > 0
}

/**
 * First-run setup: create the clinic settings row and the owner account.
 * The settings row (fixed id = 1) doubles as a lock: a second concurrent
 * setup fails on the primary key instead of creating a second owner.
 */
export async function completeSetup(input: z.output<typeof setupSchema>) {
  if (await isSetupComplete()) throw new AppError("conflict", "setup_already_done")

  await db.clinicSettings.create({ data: { id: 1, name: input.clinicName } })

  try {
    const { user } = await auth.api.createUser({
      body: {
        name: input.ownerName,
        email: placeholderEmail(input.username),
        password: input.password,
        role: "owner",
        data: { username: input.username, displayUsername: input.username },
      },
    })

    await recordAudit(db, {
      userId: user.id,
      action: "setup",
      entity: "clinic",
      entityId: "1",
      after: { clinicName: input.clinicName, owner: input.username },
    })
  } catch (error) {
    // Undo the lock so setup can be retried.
    await db.clinicSettings.delete({ where: { id: 1 } })
    throw error
  }
}

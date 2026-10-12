import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { clinicSettingsSchema } from "./schemas"

export async function updateClinicSettings(
  actor: CurrentUser,
  input: z.output<typeof clinicSettingsSchema>,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.clinicSettings.findUnique({
      where: { id: 1 },
      select: {
        name: true,
        phone: true,
        address: true,
        receiptFooter: true,
        invoiceDueDays: true,
        printPaper: true,
        receiptPaper: true,
      },
    })
    if (!before) throw new AppError("not_found")

    await tx.clinicSettings.update({ where: { id: 1 }, data: input })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "clinic_settings",
      entityId: "1",
      before,
      after: input,
    })
  })
}

/** The clinic's logo on printouts; returns the file it replaced, for the caller to delete. */
export async function setClinicLogo(actor: CurrentUser, logoFile: string | null) {
  return db.$transaction(async (tx) => {
    const before = await tx.clinicSettings.findUnique({
      where: { id: 1 },
      select: { logoFile: true },
    })
    if (!before) throw new AppError("not_found")
    await tx.clinicSettings.update({ where: { id: 1 }, data: { logoFile } })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "clinic_settings",
      entityId: "1",
      before: { logoFile: before.logoFile },
      after: { logoFile },
    })
    return before.logoFile
  })
}

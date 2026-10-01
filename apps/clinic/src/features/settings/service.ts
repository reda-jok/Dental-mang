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

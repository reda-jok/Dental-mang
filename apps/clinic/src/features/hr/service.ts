import "server-only"

import type { z } from "zod"

import { todayIso } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import type { setPaySchema } from "./schemas"

/**
 * Sets how a dentist is paid from a month on (a new version; earlier months keep theirs).
 * Not before the current month, so a month already worked out never changes.
 */
export async function setDentistPay(
  actor: CurrentUser,
  input: z.output<typeof setPaySchema>,
  today = todayIso(env.CLINIC_TIMEZONE),
) {
  if (input.effectiveFrom < today.slice(0, 7)) {
    throw new AppError("validation", "payMonthPast", { effectiveFrom: ["payMonthPast"] })
  }
  return db.$transaction(async (tx) => {
    const dentist = await tx.user.findFirst({
      where: { id: input.dentistId, role: "dentist" },
      select: { id: true },
    })
    if (!dentist) throw new AppError("not_found")
    const pay = await tx.dentistPay.create({
      data: {
        dentistId: dentist.id,
        payType: input.payType,
        commissionRate: input.payType === "salary" ? "0" : input.commissionRate,
        monthlySalary: input.payType === "commission" ? null : input.monthlySalary,
        deductLab: input.deductLab,
        effectiveFrom: new Date(`${input.effectiveFrom}-01T00:00:00Z`),
        createdById: actor.id,
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "dentist_pay",
      entityId: pay.id,
      after: input,
    })
    return pay
  })
}

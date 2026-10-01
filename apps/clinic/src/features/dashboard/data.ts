import "server-only"

import { connection } from "next/server"

import { toIsoDate, startOfMonthUtc } from "@/lib/dates"
import { subtractAmounts, sumByCurrency, type Currency } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { db } from "@/server/db"
import { env } from "@/server/env"
import type { CurrentUser } from "@/server/session"

/**
 * Dashboard numbers, limited to what the user may see: patient counts for anyone
 * who reads patients; treatment figures only for clinical staff.
 */
export async function getDashboard(user: CurrentUser) {
  await connection()
  const monthStart = startOfMonthUtc(env.CLINIC_TIMEZONE)
  const canPatients = hasPermission(user.role, "patient:read")
  const canClinical = hasPermission(user.role, "clinical:read")
  const alive = { deletedAt: null }

  const [totalPatients, newPatients, openPlans, doneItems] = await Promise.all([
    canPatients ? db.patient.count({ where: alive }) : null,
    canPatients ? db.patient.count({ where: { ...alive, createdAt: { gte: monthStart } } }) : null,
    canClinical
      ? db.treatmentPlan.count({
          where: { status: { in: ["proposed", "accepted"] }, patient: alive },
        })
      : null,
    canClinical
      ? db.treatmentPlanItem.findMany({
          where: { status: "done", completedAt: { gte: monthStart }, plan: { patient: alive } },
          select: { price: true, discount: true, currency: true },
        })
      : null,
  ])

  return {
    monthStart: toIsoDate(monthStart),
    totalPatients,
    newPatients,
    openPlans,
    doneThisMonth: doneItems
      ? {
          count: doneItems.length,
          totals: sumByCurrency(
            doneItems.map((i) => ({
              amount: subtractAmounts(i.price.toString(), i.discount.toString()),
              currency: i.currency as Currency,
            })),
          ),
        }
      : null,
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>

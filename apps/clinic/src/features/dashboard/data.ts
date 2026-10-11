import "server-only"

import { connection } from "next/server"

import { toIsoDate, startOfMonthUtc } from "@/lib/dates"
import { subtractAmounts, sumByCurrency, type Currency } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { can } from "@/server/permissions"
import type { CurrentUser } from "@/server/session"

import { storedLayoutSchema } from "./schemas"
import { resolveLayout, WIDGETS, type WidgetKey } from "./widgets"

/**
 * The user's dashboard: their own layout, else the owner's default for their role, else
 * the default order; only widgets their role may see. `custom` = they saved their own.
 */
export async function getDashboardLayout(user: CurrentUser) {
  await connection()
  const allowed = new Set<WidgetKey>()
  for (const w of WIDGETS) if (await can(user, w.permission)) allowed.add(w.key)
  const rows = await db.dashboardLayout.findMany({
    where: { OR: [{ userId: user.id }, { role: user.role }] },
    select: { userId: true, widgets: true },
  })
  const parse = (row?: { widgets: unknown }) => {
    const parsed = storedLayoutSchema.safeParse(row?.widgets)
    return parsed.success ? parsed.data : null
  }
  const own = rows.find((r) => r.userId)
  return {
    items: resolveLayout(parse(own) ?? parse(rows.find((r) => !r.userId)), allowed),
    custom: !!own,
  }
}

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

import "server-only"

import { connection } from "next/server"

import {
  addDays,
  isoDateInZone,
  minutesInZone,
  startOfDayUtc,
  startOfMonthUtc,
  todayIso,
  toIsoDate,
  weekdayOf,
} from "@/lib/dates"
import { subtractAmounts, sumByCurrency, type Currency } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { can } from "@/server/permissions"
import { authorize, type CurrentUser } from "@/server/session"

import { storedLayoutSchema } from "./schemas"
import { attendanceRates, busyGrid, previousMonth, topProcedures } from "./stats"
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

const tz = () => env.CLINIC_TIMEZONE

/** No-show and cancellation rates this month against last month (past appointments only). */
export async function getAttendance() {
  await authorize("appointment:read")
  const now = new Date()
  const month = todayIso(tz(), now).slice(0, 7)
  const thisStart = startOfDayUtc(`${month}-01`, tz())
  const lastStart = startOfDayUtc(`${previousMonth(month)}-01`, tz())
  const counts = (from: Date, to: Date) =>
    db.appointment
      .groupBy({
        by: ["status"],
        where: { startsAt: { gte: from, lt: to }, patient: { deletedAt: null } },
        _count: true,
      })
      .then((rows) => Object.fromEntries(rows.map((r) => [r.status, r._count])))
  const [thisMonth, lastMonth] = await Promise.all([
    counts(thisStart, now),
    counts(lastStart, thisStart),
  ])
  return { thisMonth: attendanceRates(thisMonth), lastMonth: attendanceRates(lastMonth) }
}

/** The procedures done most this month, with how many and their value. */
export async function getTopProcedures() {
  await authorize("clinical:read")
  const items = await db.treatmentPlanItem.findMany({
    where: {
      status: "done",
      completedAt: { gte: startOfMonthUtc(tz()) },
      plan: { patient: { deletedAt: null } },
    },
    select: { price: true, discount: true, procedure: { select: { id: true, name: true } } },
  })
  return topProcedures(
    items.map((i) => ({
      procedureId: i.procedure.id,
      name: i.procedure.name,
      net: subtractAmounts(i.price.toString(), i.discount.toString()),
    })),
  )
}

/** Booked appointments (not cancelled) of the last 90 days by weekday and hour. */
export async function getBusyHours() {
  await authorize("appointment:read")
  const today = todayIso(tz())
  const [settings, rows] = await Promise.all([
    db.clinicSettings.findUnique({
      where: { id: 1 },
      select: { weeklyOffDays: true, dayStartMinutes: true, dayEndMinutes: true },
    }),
    db.appointment.findMany({
      where: {
        status: { not: "cancelled" },
        startsAt: { gte: startOfDayUtc(addDays(today, -90), tz()), lt: startOfDayUtc(today, tz()) },
      },
      select: { startsAt: true },
    }),
  ])
  const off = settings?.weeklyOffDays ?? [5]
  // The clinic's week starts on Saturday.
  const weekdays = [6, 0, 1, 2, 3, 4, 5].filter((d) => !off.includes(d))
  const first = Math.floor((settings?.dayStartMinutes ?? 930) / 60)
  const last = Math.ceil((settings?.dayEndMinutes ?? 1320) / 60) - 1
  const hours = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i)
  return busyGrid(
    rows.map((r) => ({
      weekday: weekdayOf(isoDateInZone(r.startsAt, tz())),
      hour: Math.floor(minutesInZone(r.startsAt, tz()) / 60),
    })),
    weekdays,
    hours,
  )
}

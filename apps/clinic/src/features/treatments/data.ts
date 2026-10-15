import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { isoDateInZone, nextMonth, startOfDayUtc, todayIso } from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { withShares } from "../accounting/reports"
import { searchWhere } from "../patients/data"
import { OPEN_ITEM_STATUSES, planProgress, tally, type ListItem } from "./rules"

export const PAGE_SIZE = 20

const tz = () => env.CLINIC_TIMEZONE

/** "YYYY-MM" of today in the clinic's time zone. */
export const currentMonth = () => todayIso(tz()).slice(0, 7)

const patientWhere = (q?: string): Prisma.PatientWhereInput =>
  q ? searchWhere(q) : { deletedAt: null }

const itemSelect = {
  status: true,
  phase: true,
  price: true,
  discount: true,
  tooth: true,
  procedure: { select: { name: true } },
  dentist: { select: { name: true } },
} satisfies Prisma.TreatmentPlanItemSelect

type ItemRow = Prisma.TreatmentPlanItemGetPayload<{ select: typeof itemSelect }>

const toItem = (i: ItemRow): ListItem => ({
  status: i.status,
  phase: i.phase,
  price: i.price.toString(),
  discount: i.discount.toString(),
  tooth: i.tooth,
  procedureName: i.procedure.name,
  dentistName: i.dentist?.name ?? null,
})

/** Visits still ahead: booked from today on (a patient running late today still counts). */
const upcoming = () => ({
  status: { in: ["pending" as const, "in_progress" as const] },
  startsAt: { gte: startOfDayUtc(todayIso(tz()), tz()) },
})

async function nextVisits(patientIds: string[]) {
  const rows = await db.appointment.groupBy({
    by: ["patientId"],
    where: { patientId: { in: patientIds }, ...upcoming() },
    _min: { startsAt: true },
  })
  return new Map(rows.map((r) => [r.patientId, r._min.startsAt]))
}

async function lastVisits(patientIds: string[]) {
  const rows = await db.appointment.groupBy({
    by: ["patientId"],
    where: { patientId: { in: patientIds }, status: "completed" },
    _max: { startsAt: true },
  })
  return new Map(rows.map((r) => [r.patientId, r._max.startsAt]))
}

/** Plans proposed or under way, newest first, with progress, value left and the next visit. */
export async function listOpenPlans(filter: {
  q?: string
  status?: "proposed" | "accepted"
  page: number
}) {
  await authorize("treatments:read")
  const where: Prisma.TreatmentPlanWhereInput = {
    status: filter.status ?? { in: ["proposed", "accepted"] },
    patient: patientWhere(filter.q),
  }
  const [total, plans] = await Promise.all([
    db.treatmentPlan.count({ where }),
    db.treatmentPlan.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        patient: { select: { id: true, fullName: true, code: true } },
        items: { select: itemSelect },
      },
    }),
  ])
  const next = await nextVisits([...new Set(plans.map((p) => p.patient.id))])
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: plans.map(({ items, ...plan }) => ({
      ...plan,
      ...planProgress(items.map(toItem)),
      nextVisit: next.get(plan.patient.id) ?? null,
    })),
  }
}

export type OpenPlanRow = Awaited<ReturnType<typeof listOpenPlans>>["rows"][number]

/**
 * Accepted plans with treatments left whose patient has nothing booked: the list to call,
 * longest without a visit first.
 */
export async function listPlansToCall(filter: { q?: string; page: number }) {
  await authorize("treatments:read")
  const plans = await db.treatmentPlan.findMany({
    where: {
      status: "accepted",
      items: { some: { status: { in: [...OPEN_ITEM_STATUSES] } } },
      patient: { ...patientWhere(filter.q), appointments: { none: upcoming() } },
    },
    select: {
      id: true,
      title: true,
      acceptedAt: true,
      createdAt: true,
      patient: { select: { id: true, fullName: true, code: true, phone: true } },
      items: { select: itemSelect },
    },
  })
  const last = await lastVisits([...new Set(plans.map((p) => p.patient.id))])
  const rows = plans
    .map(({ items, ...plan }) => {
      const lastVisit = last.get(plan.patient.id) ?? null
      return {
        ...plan,
        ...planProgress(items.map(toItem)),
        lastVisit: lastVisit ? isoDateInZone(lastVisit, tz()) : null,
        // Never seen since: waiting from when the plan was agreed.
        since: isoDateInZone(lastVisit ?? plan.acceptedAt ?? plan.createdAt, tz()),
      }
    })
    .sort((a, b) => a.since.localeCompare(b.since))
  // ponytail: sorted in memory (a clinic has hundreds of open plans at most); SQL if it grows.
  return {
    total: rows.length,
    pageCount: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    rows: rows.slice((filter.page - 1) * PAGE_SIZE, filter.page * PAGE_SIZE),
    today: todayIso(tz()),
  }
}

export type PlanToCallRow = Awaited<ReturnType<typeof listPlansToCall>>["rows"][number]

/** The month's treatments marked done: per dentist (count and value) and each one. */
export async function getWorkByDentist(month = currentMonth()) {
  await authorize("treatments:reports")
  const items = await db.treatmentPlanItem.findMany({
    where: {
      status: "done",
      completedAt: {
        gte: startOfDayUtc(`${month}-01`, tz()),
        lt: startOfDayUtc(`${nextMonth(month)}-01`, tz()),
      },
      plan: { patient: { deletedAt: null } },
    },
    orderBy: [{ completedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      completedAt: true,
      price: true,
      discount: true,
      tooth: true,
      procedure: { select: { name: true } },
      dentist: { select: { id: true, name: true } },
      plan: { select: { patient: { select: { id: true, fullName: true, code: true } } } },
    },
  })
  const rows = items.map((i) => ({
    id: i.id,
    day: isoDateInZone(i.completedAt!, tz()),
    price: i.price.toString(),
    discount: i.discount.toString(),
    tooth: i.tooth,
    procedureName: i.procedure.name,
    dentistId: i.dentist?.id ?? null,
    dentistName: i.dentist?.name ?? null,
    patient: i.plan.patient,
  }))
  return {
    month,
    rows,
    byDentist: withShares(
      tally(rows, (r) => ({ key: r.dentistId ?? "none", label: r.dentistName })),
    ),
  }
}

export type WorkRow = Awaited<ReturnType<typeof getWorkByDentist>>["rows"][number]

/** Treatments still to do in open plans: agreed (accepted) and waiting for the patient (proposed). */
export async function getValueToDo() {
  await authorize("treatments:reports")
  const items = await db.treatmentPlanItem.findMany({
    where: {
      status: { in: [...OPEN_ITEM_STATUSES] },
      plan: { status: { in: ["proposed", "accepted"] }, patient: { deletedAt: null } },
    },
    select: {
      planId: true,
      price: true,
      discount: true,
      dentist: { select: { id: true, name: true } },
      procedure: { select: { category: { select: { id: true, name: true } } } },
      plan: { select: { status: true } },
    },
  })
  const rows = items.map((i) => ({
    planId: i.planId,
    status: i.plan.status,
    price: i.price.toString(),
    discount: i.discount.toString(),
    dentist: i.dentist,
    category: i.procedure.category,
  }))
  const summary = (status: "accepted" | "proposed") => {
    const of = rows.filter((r) => r.status === status)
    return {
      amount: tally(of, () => ({ key: status, label: null }))[0]?.amount ?? "0",
      treatments: of.length,
      plans: new Set(of.map((r) => r.planId)).size,
    }
  }
  const accepted = rows.filter((r) => r.status === "accepted")
  return {
    accepted: summary("accepted"),
    proposed: summary("proposed"),
    byDentist: withShares(
      tally(accepted, (r) => ({ key: r.dentist?.id ?? "none", label: r.dentist?.name ?? null })),
    ),
    byCategory: withShares(
      tally(accepted, (r) => ({ key: r.category.id, label: r.category.name })),
    ),
  }
}

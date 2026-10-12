import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { addDays, isoDateInZone, startOfDayUtc } from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { ACTIVITY_AREAS, describe, SENSITIVE_ACTIONS, type ActivityFilter } from "./rules"
import type { ActivitySearch } from "./schemas"

export const ACTIVITY_PAGE_SIZE = 50

function areaWhere(area: ActivityFilter): Prisma.AuditLogWhereInput {
  if (area === "all") return {}
  if (area === "sensitive") return { action: { in: [...SENSITIVE_ACTIONS] } }
  return { entity: { in: [...ACTIVITY_AREAS[area]] } }
}

/** The activity history, newest first, one page at a time. */
export async function listActivity({ person, area, day, page }: ActivitySearch) {
  await authorize("settings:activity")
  const tz = env.CLINIC_TIMEZONE
  const where: Prisma.AuditLogWhereInput = {
    ...(person && { userId: person }),
    ...areaWhere(area),
    ...(day && {
      createdAt: { gte: startOfDayUtc(day, tz), lt: startOfDayUtc(addDays(day, 1), tz) },
    }),
  }
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ])

  const entries = rows.map((row) => ({ row, detail: describe(row) }))
  const patientIds = [...new Set(entries.flatMap(({ detail }) => detail.patientId ?? []))]
  const patients = patientIds.length
    ? await db.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, fullName: true },
      })
    : []
  const patientName = new Map(patients.map((p) => [p.id, p.fullName]))

  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
    rows: entries.map(({ row, detail: { patientId, ...facts } }) => ({
      id: row.id,
      at: row.createdAt,
      day: isoDateInZone(row.createdAt, tz),
      action: row.action,
      entity: row.entity,
      person: row.user?.name ?? null,
      // Shown only where it says something: where a failed sign-in came from.
      ip: row.action === "login_failed" ? row.ipAddress : null,
      ...facts,
      patient: patientId ? { id: patientId, name: patientName.get(patientId) ?? null } : null,
    })),
  }
}

export type ActivityRow = Awaited<ReturnType<typeof listActivity>>["rows"][number]

/** Everyone who can appear in the history, for the person filter (former staff too). */
export async function listActivityPeople() {
  await authorize("settings:activity")
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
}

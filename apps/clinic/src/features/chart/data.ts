import "server-only"

import { getTranslations } from "next-intl/server"

import { db } from "@/server/db"
import { authorize } from "@/server/session"

import type { BuiltInCondition, ConditionInfo } from "./teeth"

async function loadConditions() {
  const [rows, t] = await Promise.all([
    db.toothCondition.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        code: true,
        name: true,
        color: true,
        scope: true,
        kind: true,
        builtIn: true,
        hiddenAt: true,
      },
    }),
    getTranslations("chart.conditions"),
  ])
  return rows.map((c) => ({
    ...c,
    /** What the clinic sees: its own name, or a built-in condition's usual one. */
    label: c.name ?? (c.builtIn ? t(c.code as BuiltInCondition) : c.code),
  }))
}

/** Every condition the chart can draw, hidden ones included (teeth may still have them). */
export async function getToothConditions(): Promise<ConditionInfo[]> {
  await authorize("clinical:read")
  return (await loadConditions()).map((c) => ({
    code: c.code,
    name: c.label,
    color: c.color,
    scope: c.scope,
    kind: c.kind,
    hidden: c.hiddenAt !== null,
  }))
}

/** Settings → Tooth conditions, and the procedure dialog's "on the chart" choice. */
export async function getConditionsForSettings() {
  await authorize("settings:read")
  return loadConditions()
}

export type ConditionRow = Awaited<ReturnType<typeof getConditionsForSettings>>[number]

/** Everything the chart draws: open findings + items of plans that aren't cancelled. */
export async function getChartData(patientId: string) {
  await authorize("clinical:read")
  const [findings, items] = await Promise.all([
    db.toothFinding.findMany({
      where: { patientId, resolvedAt: null, patient: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        tooth: true,
        surfaces: true,
        condition: true,
        notes: true,
        createdAt: true,
      },
    }),
    db.treatmentPlanItem.findMany({
      where: { plan: { patientId, status: { not: "cancelled" } }, tooth: { not: null } },
      orderBy: [{ completedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: {
        id: true,
        tooth: true,
        surfaces: true,
        status: true,
        procedure: { select: { name: true, chartResult: true } },
      },
    }),
  ])
  return {
    findings,
    items: items.map(({ procedure, ...i }) => ({
      ...i,
      procedureName: procedure.name,
      chartResult: procedure.chartResult,
    })),
  }
}

export type ChartData = Awaited<ReturnType<typeof getChartData>>

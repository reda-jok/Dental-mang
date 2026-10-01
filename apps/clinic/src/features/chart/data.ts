import "server-only"

import { db } from "@/server/db"
import { authorize } from "@/server/session"

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

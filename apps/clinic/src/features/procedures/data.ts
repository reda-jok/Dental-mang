import "server-only"

import type { Currency } from "@/lib/money"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

const procedureSelect = {
  id: true,
  name: true,
  categoryId: true,
  price: true,
  currency: true,
  toothScope: true,
  chartResult: true,
  durationMinutes: true,
  requiresLab: true,
} as const

type Row = { price: { toString(): string }; currency: Currency }
const serialize = <T extends Row>(p: T) => ({ ...p, price: p.price.toString() })

async function catalog() {
  const categories = await db.procedureCategory.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      procedures: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: procedureSelect,
      },
    },
  })
  return categories.map((c) => ({ ...c, procedures: c.procedures.map(serialize) }))
}

/** For the catalog settings page. */
export async function getCatalogForSettings() {
  await authorize("settings:read")
  return catalog()
}

/** For choosing procedures while charting and planning. */
export async function getCatalogForPlanning() {
  await authorize("clinical:read")
  return catalog()
}

export type Catalog = Awaited<ReturnType<typeof catalog>>
export type CatalogProcedure = Catalog[number]["procedures"][number]

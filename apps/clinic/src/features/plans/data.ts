import "server-only"

import { sumByCurrency, subtractAmounts, type Currency } from "@/lib/money"
import { db } from "@/server/db"
import { authorize } from "@/server/session"

export async function getPlans(patientId: string) {
  await authorize("clinical:read")
  const plans = await db.treatmentPlan.findMany({
    where: { patientId, patient: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      notes: true,
      createdAt: true,
      acceptedAt: true,
      createdBy: { select: { name: true } },
      items: {
        orderBy: [{ phase: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          tooth: true,
          surfaces: true,
          phase: true,
          price: true,
          currency: true,
          discount: true,
          status: true,
          notes: true,
          completedAt: true,
          procedure: { select: { name: true } },
          dentist: { select: { name: true } },
        },
      },
    },
  })

  return plans.map(({ createdBy, items, ...plan }) => {
    const rows = items.map(({ procedure, dentist, price, discount, ...item }) => {
      const net = subtractAmounts(price.toString(), discount.toString())
      return {
        ...item,
        procedureName: procedure.name,
        dentistName: dentist?.name ?? null,
        price: price.toString(),
        discount: discount.toString(),
        net,
        currency: item.currency as Currency,
      }
    })
    const active = rows.filter((r) => r.status !== "cancelled")
    return {
      ...plan,
      createdByName: createdBy?.name ?? null,
      items: rows,
      total: sumByCurrency(active.map((r) => ({ amount: r.net, currency: r.currency }))),
      done: sumByCurrency(
        active
          .filter((r) => r.status === "done")
          .map((r) => ({ amount: r.net, currency: r.currency })),
      ),
    }
  })
}

export type PlanView = Awaited<ReturnType<typeof getPlans>>[number]

import "server-only"

import { toIsoDate } from "@/lib/dates"
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

/** A treatment plan as a printable quote for the patient (cancelled items left out). */
export async function getPlanQuote(id: string) {
  await authorize("clinical:read")
  const plan = await db.treatmentPlan.findFirst({
    where: { id, patient: { deletedAt: null } },
    select: {
      id: true,
      title: true,
      status: true,
      notes: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      patient: {
        select: { fullName: true, code: true, phone: true, birthDate: true, gender: true },
      },
      items: {
        where: { status: { not: "cancelled" } },
        orderBy: [{ phase: "asc" }, { tooth: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          tooth: true,
          surfaces: true,
          phase: true,
          price: true,
          currency: true,
          discount: true,
          procedure: { select: { name: true } },
        },
      },
    },
  })
  if (!plan) return null
  const items = plan.items.map(({ procedure, price, discount, ...item }) => ({
    ...item,
    procedureName: procedure.name,
    price: price.toString(),
    discount: discount.toString(),
    net: subtractAmounts(price.toString(), discount.toString()),
    currency: item.currency as Currency,
  }))
  return {
    ...plan,
    createdByName: plan.createdBy?.name ?? null,
    patient: {
      ...plan.patient,
      birthDate: plan.patient.birthDate ? toIsoDate(plan.patient.birthDate) : null,
    },
    items,
    phases: [...new Set(items.map((i) => i.phase))],
    total: sumByCurrency(items.map((i) => ({ amount: i.net, currency: i.currency }))),
    discount: sumByCurrency(items.map((i) => ({ amount: i.discount, currency: i.currency }))),
  }
}

export type PlanQuote = NonNullable<Awaited<ReturnType<typeof getPlanQuote>>>

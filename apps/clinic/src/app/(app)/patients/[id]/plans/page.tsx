import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CheckCircle2Icon } from "lucide-react"
import { Panel } from "@/components/panel"

import { listPatientAppointments } from "@/features/appointments/data"
import { getPlanPaid } from "@/features/billing/data"
import { PlansList } from "@/features/plans/components/plans-list"
import { getPlans } from "@/features/plans/data"
import { ageInYears, todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plans")
  return { title: t("title") }
}

export default async function PlansPage({ params }: PageProps<"/patients/[id]/plans">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const [plans, appointments, t] = await Promise.all([
    getPlans(patient.id),
    hasPermission(user, "appointment:read") ? listPatientAppointments(patient.id) : null,
    getTranslations("plans"),
  ])
  // What's been paid towards each plan, for staff who see billing.
  const paid = hasPermission(user, "billing:read")
    ? Object.fromEntries(
        await Promise.all(plans.map(async (p) => [p.id, await getPlanPaid(p.id)] as const)),
      )
    : null
  // Appointments come newest first: the next one is the last upcoming.
  const next = appointments?.filter((a) => a.upcoming).at(-1)
  return (
    <Panel icon={CheckCircle2Icon} title={t("title")} description={t("description")}>
      <PlansList
        patient={{
          id: patient.id,
          fullName: patient.fullName,
          phone: patient.phone,
          age: patient.birthDate ? ageInYears(patient.birthDate, todayIso()) : null,
        }}
        plans={plans}
        canEdit={hasPermission(user, "clinical:write")}
        paid={paid}
        nextVisit={
          appointments === null
            ? undefined
            : next
              ? { date: next.date, time: next.time, dentistName: next.dentist?.name ?? null }
              : null
        }
      />
    </Panel>
  )
}

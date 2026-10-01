import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CheckCircle2Icon } from "lucide-react"
import { Panel } from "@/components/panel"

import { PlansList } from "@/features/plans/components/plans-list"
import { getPlans } from "@/features/plans/data"
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
  const [plans, t] = await Promise.all([getPlans(patient.id), getTranslations("plans")])
  return (
    <Panel icon={CheckCircle2Icon} title={t("title")} description={t("description")}>
      <PlansList
        patientId={patient.id}
        plans={plans}
        canEdit={hasPermission(user.role, "clinical:write")}
      />
    </Panel>
  )
}

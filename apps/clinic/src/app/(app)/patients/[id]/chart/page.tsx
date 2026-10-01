import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ActivityIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { ChartWorkspace } from "@/features/chart/components/chart-workspace"
import { getChartData } from "@/features/chart/data"
import { getPlans } from "@/features/plans/data"
import { isPlanOpen } from "@/features/plans/rules"
import { getCatalogForPlanning } from "@/features/procedures/data"
import { ageInYears, todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chart")
  return { title: t("title") }
}

export default async function ChartPage({ params }: PageProps<"/patients/[id]/chart">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const [data, catalog, plans, t] = await Promise.all([
    getChartData(patient.id),
    getCatalogForPlanning(),
    getPlans(patient.id),
    getTranslations("chart"),
  ])

  // Children: primary teeth under ~6, mixed until ~12.
  const age = patient.birthDate ? ageInYears(patient.birthDate, todayIso()) : null
  const dentition = age === null || age >= 12 ? "permanent" : age < 6 ? "primary" : "mixed"

  return (
    <Panel icon={ActivityIcon} title={t("title")} description={t("description")}>
      <ChartWorkspace
        patientId={patient.id}
        data={data}
        catalog={catalog}
        openPlans={plans
          .filter((p) => isPlanOpen(p.status))
          .map(({ id, title }) => ({ id, title }))}
        canEdit={hasPermission(user.role, "clinical:write")}
        defaultDentition={dentition}
      />
    </Panel>
  )
}

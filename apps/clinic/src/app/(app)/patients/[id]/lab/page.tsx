import { FlaskConicalIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { LabCaseButton } from "@/features/lab/components/lab-case-dialog"
import { LabCasesTable } from "@/features/lab/components/lab-cases-table"
import { getLabFormOptions, getLabPlanItems, listPatientLabCases } from "@/features/lab/data"
import { todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lab")
  return { title: t("patientTab") }
}

export default async function PatientLabPage({ params }: PageProps<"/patients/[id]/lab">) {
  const user = await requirePagePermission("lab:read")
  const patient = await loadPatient((await params).id)
  const canWrite = hasPermission(user.role, "lab:write")
  const [cases, options, planItems, t] = await Promise.all([
    listPatientLabCases(patient.id),
    canWrite ? getLabFormOptions() : null,
    canWrite ? getLabPlanItems(patient.id) : [],
    getTranslations("lab"),
  ])
  return (
    <Panel
      icon={FlaskConicalIcon}
      title={t("patientTab")}
      description={
        options && options.labs.length === 0 ? t("addLabFirst") : t("patientDescription")
      }
      className="min-w-0"
      contentClassName="p-0"
      actions={
        options && <LabCaseButton options={options} patientId={patient.id} planItems={planItems} />
      }
    >
      {cases.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-slate-500">{t("noPatientCases")}</p>
      ) : (
        <LabCasesTable
          rows={cases}
          today={options?.today ?? todayIso()}
          options={options}
          showPatient={false}
        />
      )}
    </Panel>
  )
}

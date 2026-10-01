import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import { HeartPulseIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { MedicalHistoryForm } from "@/features/patients/components/medical-history-form"
import { getMedicalHistory } from "@/features/patients/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("medical")
  return { title: t("title") }
}

export default async function MedicalHistoryPage({ params }: PageProps<"/patients/[id]/medical">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const [history, t, format] = await Promise.all([
    getMedicalHistory(patient.id),
    getTranslations("medical"),
    getFormatter(),
  ])

  return (
    <Panel
      icon={HeartPulseIcon}
      title={t("title")}
      description={
        <>
          {t("description")}
          {history && (
            <span className="mt-1 block text-xs">
              {t("lastUpdated", {
                name: history.recordedByName ?? "—",
                date: format.dateTime(history.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
                version: String(history.version),
              })}
            </span>
          )}
        </>
      }
    >
      {/* key: re-mount after a save so the form starts from the new version */}
      <MedicalHistoryForm
        key={history?.version ?? 0}
        patientId={patient.id}
        gender={patient.gender}
        history={history}
        canEdit={hasPermission(user.role, "clinical:write")}
      />
    </Panel>
  )
}

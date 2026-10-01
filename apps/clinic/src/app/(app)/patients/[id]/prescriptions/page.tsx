import { PillIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { NewPrescriptionButton } from "@/features/prescriptions/components/new-prescription-dialog"
import { PrescriptionsList } from "@/features/prescriptions/components/prescriptions-list"
import { getPrescriptionFormData, listPrescriptions } from "@/features/prescriptions/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prescriptions")
  return { title: t("title") }
}

export default async function PrescriptionsPage({
  params,
}: PageProps<"/patients/[id]/prescriptions">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const canPrescribe = hasPermission(user.role, "clinical:prescribe")
  const [prescriptions, formData, t] = await Promise.all([
    listPrescriptions(patient.id),
    canPrescribe ? getPrescriptionFormData(patient.id) : null,
    getTranslations("prescriptions"),
  ])
  return (
    <Panel
      icon={PillIcon}
      title={t("title")}
      description={canPrescribe ? t("description") : t("readOnly")}
      className="min-w-0"
      actions={formData && <NewPrescriptionButton patientId={patient.id} data={formData} />}
    >
      {prescriptions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <PrescriptionsList prescriptions={prescriptions} />
      )}
    </Panel>
  )
}

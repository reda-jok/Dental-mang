import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { UserPlusIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { PatientForm } from "@/features/patients/components/patient-form"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("patients")
  return { title: t("newTitle") }
}

export default async function NewPatientPage() {
  await requirePagePermission("patient:write")
  const t = await getTranslations("patients")
  return (
    <Panel icon={UserPlusIcon} title={t("newTitle")} description={t("newDescription")}>
      <PatientForm mode="create" />
    </Panel>
  )
}

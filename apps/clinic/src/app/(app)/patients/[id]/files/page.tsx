import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AttachmentsPanel } from "@/features/patients/components/attachments-panel"
import { listAttachments } from "@/features/patients/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("files")
  return { title: t("title") }
}

export default async function PatientFilesPage({ params }: PageProps<"/patients/[id]/files">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const rows = await listAttachments(patient.id)

  return (
    <AttachmentsPanel
      patientId={patient.id}
      rows={rows}
      canEdit={hasPermission(user.role, "clinical:write")}
    />
  )
}

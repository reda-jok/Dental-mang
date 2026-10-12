import { NotebookPenIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { NewNoteButton } from "@/features/notes/components/note-form-dialogs"
import { NotesList } from "@/features/notes/components/notes-list"
import { getClinicalNoteFormData, listClinicalNotes } from "@/features/notes/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("clinicalNotes")
  return { title: t("title") }
}

export default async function NotesPage({ params }: PageProps<"/patients/[id]/notes">) {
  const user = await requirePagePermission("clinical:read")
  const patient = await loadPatient((await params).id)
  const canWrite = hasPermission(user, "clinical:write")
  const [notes, formData, t] = await Promise.all([
    listClinicalNotes(patient.id),
    canWrite ? getClinicalNoteFormData(patient.id) : null,
    getTranslations("clinicalNotes"),
  ])
  return (
    <Panel
      icon={NotebookPenIcon}
      title={t("title")}
      description={canWrite ? t("description") : t("readOnly")}
      className="min-w-0"
      actions={formData && <NewNoteButton patientId={patient.id} data={formData} />}
    >
      {notes.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <NotesList notes={notes} canWrite={canWrite} />
      )}
    </Panel>
  )
}

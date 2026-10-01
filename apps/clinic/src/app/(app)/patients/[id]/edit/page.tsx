import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PencilIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { PatientForm } from "@/features/patients/components/patient-form"
import { ageInYears, todayIso } from "@/lib/dates"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("patients")
  return { title: t("editTitle") }
}

export default async function EditPatientPage({ params }: PageProps<"/patients/[id]/edit">) {
  await requirePagePermission("patient:write")
  const patient = await loadPatient((await params).id)
  const t = await getTranslations("patients")

  return (
    <Panel icon={PencilIcon} title={t("editTitle")}>
      <PatientForm
        mode="edit"
        patientId={patient.id}
        initial={{
          fullName: patient.fullName,
          gender: patient.gender,
          // Records without a birth date must get one (an age) when edited.
          birthMode: patient.birthDate && !patient.birthDateEstimated ? "date" : "age",
          birthDate: patient.birthDate ?? "",
          // Estimated birth dates are edited as the age they represent today.
          age: patient.birthDate ? String(ageInYears(patient.birthDate, todayIso())) : "",
          phone: patient.phone ?? "",
          phone2: patient.phone2 ?? "",
          address: patient.address ?? "",
          referralSource: patient.referralSource ?? "",
          notes: patient.notes ?? "",
        }}
      />
    </Panel>
  )
}

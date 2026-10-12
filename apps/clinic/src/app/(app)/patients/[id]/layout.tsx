import { TodayVisitBar } from "@/features/appointments/components/today-visit-bar"
import { getTodayVisit } from "@/features/appointments/data"
import { MedicalAlertBanner } from "@/features/patients/components/medical-alert-banner"
import { PatientHeader } from "@/features/patients/components/patient-header"
import { PatientTabs } from "@/features/patients/components/patient-tabs"
import { getMedicalHistory } from "@/features/patients/data"
import { todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "./load"

export default async function PatientLayout({ children, params }: LayoutProps<"/patients/[id]">) {
  const user = await requirePagePermission("patient:read")
  const { id } = await params
  const patient = await loadPatient(id)
  const clinical = hasPermission(user, "clinical:read")
  const [history, todayVisit] = await Promise.all([
    clinical ? getMedicalHistory(id) : null,
    hasPermission(user, "appointment:read") ? getTodayVisit(id) : null,
  ])
  const canBook = hasPermission(user, "appointment:write")

  return (
    <div className="space-y-4">
      <PatientHeader
        patient={patient}
        today={todayIso()}
        canEdit={hasPermission(user, "patient:write")}
        canArchive={hasPermission(user, "patient:delete")}
      />
      {todayVisit && (
        <TodayVisitBar
          visit={todayVisit}
          canWrite={canBook}
          canFinish={canBook && hasPermission(user, "clinical:write")}
        />
      )}
      {clinical && <MedicalAlertBanner patientId={id} history={history} />}
      <PatientTabs
        patientId={id}
        clinical={clinical}
        appointments={hasPermission(user, "appointment:read")}
        billing={hasPermission(user, "billing:read")}
        lab={hasPermission(user, "lab:read")}
      />
      <div className="pt-2">{children}</div>
    </div>
  )
}

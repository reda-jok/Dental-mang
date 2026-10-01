import { CalendarDaysIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { AppointmentCard } from "@/features/appointments/components/appointment-card"
import { listPatientAppointments } from "@/features/appointments/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments")
  return { title: t("patientTab") }
}

export default async function PatientAppointmentsPage({
  params,
}: PageProps<"/patients/[id]/appointments">) {
  const user = await requirePagePermission("appointment:read")
  const patient = await loadPatient((await params).id)
  const [all, t] = await Promise.all([
    listPatientAppointments(patient.id),
    getTranslations("appointments"),
  ])
  const upcoming = all.filter((a) => a.upcoming).reverse()
  const past = all.filter((a) => !a.upcoming)
  const canWrite = hasPermission(user.role, "appointment:write")

  const list = (items: typeof all) =>
    items.length === 0 ? (
      <p className="text-sm text-slate-500">{t("noPatientAppointments")}</p>
    ) : (
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="space-y-1">
            <p className="text-xs font-medium text-slate-500">{a.date}</p>
            <AppointmentCard appointment={a} canWrite={canWrite} />
          </div>
        ))}
      </div>
    )

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel icon={CalendarDaysIcon} title={t("upcoming")}>
        {list(upcoming)}
      </Panel>
      <Panel icon={CalendarDaysIcon} title={t("past")}>
        {list(past)}
      </Panel>
    </div>
  )
}

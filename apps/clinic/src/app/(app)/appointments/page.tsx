import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Scheduler } from "@/features/appointments/components/scheduler"
import { getScheduleConfig, listAppointments, listHolidays } from "@/features/appointments/data"
import { schedulerParams } from "@/features/appointments/params"
import { weekOf } from "@/features/appointments/rules"
import { todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments")
  return { title: t("title") }
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const user = await requirePagePermission("appointment:read")
  const config = await getScheduleConfig()
  const today = todayIso(config.timeZone)
  const { date = today, view } = schedulerParams.parse(await searchParams)

  const days = view === "day" ? [date] : weekOf(date)
  const [appointments, holidays] = await Promise.all([
    listAppointments(days[0]!, days.at(-1)!),
    listHolidays(days[0]!, days.at(-1)!),
  ])

  return (
    <Scheduler
      date={date}
      view={view}
      today={today}
      appointments={appointments}
      holidays={holidays}
      weeklyOffDays={config.weeklyOffDays}
      canWrite={hasPermission(user.role, "appointment:write")}
    />
  )
}

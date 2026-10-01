import { CalendarClockIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { ScheduleSettings } from "@/features/appointments/components/schedule-settings"
import { getBookingOptions, getScheduleConfig } from "@/features/appointments/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments.settings")
  return { title: t("title") }
}

export default async function ScheduleSettingsPage() {
  const user = await requirePagePermission("settings:read")
  const [config, options, t] = await Promise.all([
    getScheduleConfig(),
    getBookingOptions(),
    getTranslations("appointments.settings"),
  ])
  return (
    <Panel icon={CalendarClockIcon} title={t("title")} description={t("description")}>
      <ScheduleSettings
        canEdit={hasPermission(user.role, "settings:write")}
        config={config}
        rooms={options.rooms}
      />
    </Panel>
  )
}

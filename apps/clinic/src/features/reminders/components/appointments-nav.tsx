"use client"

import { CalendarDaysIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav } from "@/components/pill-nav"

/** The appointments section: the scheduler, and the daily reminder list. */
export function AppointmentsNav() {
  const t = useTranslations("reminders")
  return (
    <PillNav
      label={t("navLabel")}
      items={[
        {
          key: "schedule",
          label: t("tabs.schedule"),
          icon: CalendarDaysIcon,
          href: "/appointments",
          exact: true,
        },
        {
          key: "reminders",
          label: t("tabs.reminders"),
          icon: MessageCircleIcon,
          href: "/appointments/reminders",
        },
      ]}
    />
  )
}

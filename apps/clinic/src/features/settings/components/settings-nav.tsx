"use client"

import { Building2Icon, CalendarClockIcon, ListChecksIcon, UsersIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav, type PillNavItem } from "@/components/pill-nav"

export function SettingsNav({ showUsers }: { showUsers: boolean }) {
  const t = useTranslations("settings")
  const ta = useTranslations("appointments.settings")
  const items: PillNavItem[] = [
    { key: "clinic", label: t("clinicTab"), icon: Building2Icon, href: "/settings/clinic" },
    {
      key: "procedures",
      label: t("proceduresTab"),
      icon: ListChecksIcon,
      href: "/settings/procedures",
    },
    { key: "schedule", label: ta("tab"), icon: CalendarClockIcon, href: "/settings/schedule" },
    ...(showUsers
      ? [{ key: "users", label: t("usersTab"), icon: UsersIcon, href: "/settings/users" }]
      : []),
  ]
  return <PillNav items={items} label={t("title")} />
}

"use client"

import {
  Building2Icon,
  CalendarClockIcon,
  ListChecksIcon,
  PillIcon,
  ShieldCheckIcon,
  SwatchBookIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav, type PillNavItem } from "@/components/pill-nav"

export function SettingsNav({ showPermissions }: { showPermissions: boolean }) {
  const t = useTranslations("settings")
  const ta = useTranslations("appointments.settings")
  const tp = useTranslations("permissions")
  const tm = useTranslations("medications")
  const tt = useTranslations("toothConditions")
  const items: PillNavItem[] = [
    { key: "clinic", label: t("clinicTab"), icon: Building2Icon, href: "/settings/clinic" },
    {
      key: "procedures",
      label: t("proceduresTab"),
      icon: ListChecksIcon,
      href: "/settings/procedures",
    },
    {
      key: "conditions",
      label: tt("tab"),
      icon: SwatchBookIcon,
      href: "/settings/conditions",
    },
    { key: "schedule", label: ta("tab"), icon: CalendarClockIcon, href: "/settings/schedule" },
    { key: "medications", label: tm("tab"), icon: PillIcon, href: "/settings/medications" },
    ...(showPermissions
      ? [
          {
            key: "permissions",
            label: tp("tab"),
            icon: ShieldCheckIcon,
            href: "/settings/permissions",
          },
        ]
      : []),
  ]
  return <PillNav items={items} label={t("title")} />
}

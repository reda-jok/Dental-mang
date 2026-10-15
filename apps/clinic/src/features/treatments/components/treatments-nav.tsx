"use client"

import { ChartColumnIcon, ClipboardListIcon, HourglassIcon, PhoneCallIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav, type PillNavItem } from "@/components/pill-nav"

/** Tabs across the treatment lists; the reports only for those who see them. */
export function TreatmentsNav({ reports }: { reports: boolean }) {
  const t = useTranslations("treatments")
  const items: PillNavItem[] = [
    {
      key: "open",
      label: t("tabs.open"),
      icon: ClipboardListIcon,
      href: "/treatments",
      exact: true,
    },
    { key: "call", label: t("tabs.call"), icon: PhoneCallIcon, href: "/treatments/call" },
    ...(reports
      ? [
          { key: "work", label: t("tabs.work"), icon: ChartColumnIcon, href: "/treatments/work" },
          { key: "todo", label: t("tabs.todo"), icon: HourglassIcon, href: "/treatments/todo" },
        ]
      : []),
  ]
  return <PillNav items={items} label={t("title")} />
}

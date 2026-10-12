"use client"

import { CoinsIcon, UsersIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav } from "@/components/pill-nav"

export function HrNav() {
  const t = useTranslations("hr")
  return (
    <PillNav
      label={t("title")}
      items={[
        { key: "staff", label: t("tabs.staff"), icon: UsersIcon, href: "/hr", exact: true },
        { key: "commission", label: t("tabs.commission"), icon: CoinsIcon, href: "/hr/commission" },
      ]}
    />
  )
}

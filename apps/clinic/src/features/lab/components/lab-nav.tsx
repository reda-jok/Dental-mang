"use client"

import { BuildingIcon, FlaskConicalIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav } from "@/components/pill-nav"

export function LabNav() {
  const t = useTranslations("lab")
  return (
    <PillNav
      label={t("title")}
      items={[
        { key: "cases", label: t("tabs.cases"), icon: FlaskConicalIcon, href: "/lab", exact: true },
        { key: "labs", label: t("tabs.labs"), icon: BuildingIcon, href: "/lab/labs" },
      ]}
    />
  )
}

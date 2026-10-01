"use client"

import {
  ActivityIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  FileImageIcon,
  HeartPulseIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav, type PillNavItem } from "@/components/pill-nav"

export function PatientTabs({
  patientId,
  clinical,
  appointments,
  billing,
}: {
  patientId: string
  clinical: boolean
  appointments: boolean
  billing: boolean
}) {
  const t = useTranslations("patients.tabs")
  const tp = useTranslations("patients")
  const base = `/patients/${patientId}`

  const items: PillNavItem[] = [
    { key: "overview", label: t("overview"), icon: UserIcon, href: base, exact: true },
    ...(clinical
      ? [
          { key: "chart", label: t("chart"), icon: ActivityIcon, href: `${base}/chart` },
          { key: "plans", label: t("plans"), icon: CheckCircle2Icon, href: `${base}/plans` },
          { key: "files", label: t("files"), icon: FileImageIcon, href: `${base}/files` },
          { key: "medical", label: t("medical"), icon: HeartPulseIcon, href: `${base}/medical` },
        ]
      : []),
    ...(appointments
      ? [
          {
            key: "appointments",
            label: t("appointments"),
            icon: CalendarDaysIcon,
            href: `${base}/appointments`,
          },
        ]
      : []),
    ...(billing
      ? [{ key: "billing", label: t("billing"), icon: WalletIcon, href: `${base}/billing` }]
      : []),
  ]

  return <PillNav items={items} label={tp("tabsLabel")} />
}

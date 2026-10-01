"use client"

import { BuildingIcon, FlaskConicalIcon, WalletIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav } from "@/components/pill-nav"

/** `accounts`: the user may see and pay what the clinic owes labs (lab:pay). */
export function LabNav({ accounts }: { accounts: boolean }) {
  const t = useTranslations("lab")
  return (
    <PillNav
      label={t("title")}
      items={[
        { key: "cases", label: t("tabs.cases"), icon: FlaskConicalIcon, href: "/lab", exact: true },
        { key: "labs", label: t("tabs.labs"), icon: BuildingIcon, href: "/lab/labs" },
        ...(accounts
          ? [
              {
                key: "accounts",
                label: t("tabs.accounts"),
                icon: WalletIcon,
                href: "/lab/accounts",
              },
            ]
          : []),
      ]}
    />
  )
}

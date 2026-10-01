"use client"

import { AlarmClockIcon, LockKeyholeIcon, ReceiptTextIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav, type PillNavItem } from "@/components/pill-nav"

/** Tabs across the billing pages. */
export function BillingNav({ showDebts }: { showDebts: boolean }) {
  const t = useTranslations("billing")
  const items: PillNavItem[] = [
    {
      key: "invoices",
      label: t("tabs.invoices"),
      icon: ReceiptTextIcon,
      href: "/billing",
      exact: true,
    },
    ...(showDebts
      ? [
          { key: "debts", label: t("tabs.debts"), icon: AlarmClockIcon, href: "/billing/debts" },
          { key: "cash", label: t("tabs.cash"), icon: LockKeyholeIcon, href: "/billing/cash" },
        ]
      : []),
  ]
  return <PillNav items={items} label={t("title")} />
}

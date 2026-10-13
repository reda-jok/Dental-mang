"use client"

import { BookOpenTextIcon, ChartPieIcon, ReceiptIcon, TrendingUpIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { PillNav } from "@/components/pill-nav"

/** Tabs across the accounts pages, for those who see the financial reports. */
export function AccountingNav() {
  const t = useTranslations("accounting")
  return (
    <PillNav
      label={t("title")}
      items={[
        {
          key: "expenses",
          label: t("tabs.expenses"),
          icon: ReceiptIcon,
          href: "/accounting",
          exact: true,
        },
        {
          key: "profit",
          label: t("tabs.profit"),
          icon: TrendingUpIcon,
          href: "/accounting/profit",
        },
        {
          key: "cashBook",
          label: t("tabs.cashBook"),
          icon: BookOpenTextIcon,
          href: "/accounting/cash-book",
        },
        {
          key: "revenue",
          label: t("tabs.revenue"),
          icon: ChartPieIcon,
          href: "/accounting/revenue",
        },
      ]}
    />
  )
}

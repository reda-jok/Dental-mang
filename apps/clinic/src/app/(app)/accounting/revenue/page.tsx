import { LayersIcon, StethoscopeIcon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { ShareList } from "@/features/accounting/components/share-list"
import { getRevenueBreakdown } from "@/features/accounting/data"
import { reportParams } from "@/features/accounting/schemas"
import { PAYMENT_METHODS } from "@/features/billing/payments"
import { MonthNav } from "@/features/hr/components/month-nav"
import { formatMoney, toMinor } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounting.tabs")
  return { title: t("revenue") }
}

export default async function RevenuePage({ searchParams }: PageProps<"/accounting/revenue">) {
  await requirePagePermission("accounting:reports")
  const { month } = reportParams.parse(await searchParams)
  const [report, t, tb, format] = await Promise.all([
    getRevenueBreakdown(month),
    getTranslations("accounting.revenue"),
    getTranslations("billing"),
    getFormatter(),
  ])
  const percent = (p: number) =>
    format.number(p / 100, { style: "percent", maximumFractionDigits: 1 })
  const rows = (
    list: typeof report.byDentist,
    label: (row: (typeof report.byDentist)[number]) => string,
  ) =>
    list.map((r) => ({
      key: r.key,
      label: label(r),
      amount: r.amount,
      bar: r.bar,
      percent: percent(r.percent),
    }))
  const extra =
    toMinor(report.extraDiscount) > 0n ? (
      <p className="text-muted-foreground mt-4 text-sm">
        {t("extraDiscount", { amount: formatMoney(report.extraDiscount, "IQD") })}
      </p>
    ) : null
  const method = (key: string) =>
    (PAYMENT_METHODS as readonly string[]).includes(key)
      ? tb(`methods.${key as (typeof PAYMENT_METHODS)[number]}`)
      : key

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MonthNav path="/accounting/revenue" month={report.month} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          icon={StethoscopeIcon}
          title={t("byDentistTitle")}
          description={t("byDentistDescription")}
        >
          <ShareList
            testId="by-dentist"
            rows={rows(report.byDentist, (r) => r.label ?? t("noDentist"))}
            empty={t("empty")}
          />
          {extra}
        </Panel>
        <Panel
          icon={LayersIcon}
          title={t("byCategoryTitle")}
          description={t("byCategoryDescription")}
        >
          <ShareList
            testId="by-category"
            rows={rows(report.byCategory, (r) => r.label ?? t("noCategory"))}
            empty={t("empty")}
          />
          {extra}
        </Panel>
      </div>
      <Panel icon={WalletIcon} title={t("byMethodTitle")} description={t("byMethodDescription")}>
        <ShareList
          testId="by-method"
          rows={rows(report.byMethod, (r) => method(r.key))}
          empty={t("emptyMethods")}
        />
      </Panel>
    </div>
  )
}

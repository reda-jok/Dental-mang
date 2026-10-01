import {
  AlarmClockIcon,
  AlertTriangleIcon,
  ClockIcon,
  HourglassIcon,
  SirenIcon,
} from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { Card, CardContent } from "@/components/ui/card"
import { DebtsTable } from "@/features/billing/components/debts-table"
import { FilterBar } from "@/features/billing/components/filter-bar"
import { getDebts } from "@/features/billing/data"
import { OVERDUE_BUCKETS } from "@/features/billing/debts"
import { DEBT_FILTERS, debtSearchSchema } from "@/features/billing/schemas"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { formatMoney } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing")
  return { title: t("tabs.debts") }
}

const CARDS = {
  d1_30: { icon: ClockIcon, className: "bg-yellow-50 text-yellow-600" },
  d31_60: { icon: HourglassIcon, className: "bg-orange-50 text-orange-600" },
  d61_90: { icon: AlertTriangleIcon, className: "bg-red-50 text-red-600" },
  d90plus: { icon: SirenIcon, className: "bg-red-100 text-red-700" },
} as const

export default async function DebtsPage({ searchParams }: PageProps<"/billing/debts">) {
  await requirePagePermission("billing:write")
  const { q, age } = debtSearchSchema.parse(await searchParams)
  const [debts, t] = await Promise.all([getDebts({ q, age }), getTranslations("billing")])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {OVERDUE_BUCKETS.map((bucket) => (
          <StatCard
            key={bucket}
            title={t(`buckets.${bucket}`)}
            value={<span dir="ltr">{formatMoney(debts.totals[bucket].amount, "IQD")}</span>}
            icon={CARDS[bucket].icon}
            iconClassName={CARDS[bucket].className}
            note={t("patientsCount", { count: debts.totals[bucket].patients })}
          />
        ))}
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent>
          <FilterBar
            q={q}
            placeholder={t("debtSearchPlaceholder")}
            hint={t("debtSearchHint")}
            filter={{
              param: "age",
              label: t("ageFilter"),
              value: age,
              defaultValue: "overdue",
              options: DEBT_FILTERS.map((f) => ({ value: f, label: t(`ageFilters.${f}`) })),
            }}
          />
        </CardContent>
      </Card>

      <Panel
        icon={AlarmClockIcon}
        title={t("debtsTitle", { count: String(debts.rows.length) })}
        description={t("debtsDescription", {
          amount: formatMoney(debts.totals.overdue.amount, "IQD"),
        })}
        className="min-w-0"
        contentClassName="p-0"
      >
        {debts.rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            {q || age !== "overdue" ? t("debtsEmptyFiltered") : t("debtsEmpty")}
          </p>
        ) : (
          <DebtsTable rows={debts.rows} clinic={debts.clinic} />
        )}
      </Panel>
    </div>
  )
}

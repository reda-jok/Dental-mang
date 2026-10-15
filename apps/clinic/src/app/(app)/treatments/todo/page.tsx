import { HourglassIcon, LayersIcon, StethoscopeIcon, TimerIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { ShareList } from "@/features/accounting/components/share-list"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { getValueToDo } from "@/features/treatments/data"
import { formatMoney } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("treatments")
  return { title: t("tabs.todo") }
}

export default async function ValueToDoPage() {
  await requirePagePermission("treatments:reports")
  const [todo, t, format] = await Promise.all([
    getValueToDo(),
    getTranslations("treatments"),
    getFormatter(),
  ])
  const money = (v: string) => <bdi>{formatMoney(v, "IQD")}</bdi>
  const percent = (p: number) =>
    format.number(p / 100, { style: "percent", maximumFractionDigits: 1 })
  const rows = (list: typeof todo.byDentist, fallback: string) =>
    list.map((r) => ({
      key: r.key,
      label: r.label ?? fallback,
      amount: r.amount,
      bar: r.bar,
      percent: percent(r.percent),
      detail: t("work.treatmentsCount", { count: r.count }),
    }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title={t("todo.accepted")}
          value={money(todo.accepted.amount)}
          icon={HourglassIcon}
          iconClassName="bg-blue-50 text-blue-600"
          note={t("todo.acceptedNote", {
            treatments: todo.accepted.treatments,
            plans: todo.accepted.plans,
          })}
        />
        <StatCard
          title={t("todo.proposed")}
          value={money(todo.proposed.amount)}
          icon={TimerIcon}
          iconClassName="bg-amber-50 text-amber-600"
          note={t("todo.acceptedNote", {
            treatments: todo.proposed.treatments,
            plans: todo.proposed.plans,
          })}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          icon={StethoscopeIcon}
          title={t("todo.byDentistTitle")}
          description={t("todo.byDentistDescription")}
        >
          <ShareList
            testId="todo-by-dentist"
            rows={rows(todo.byDentist, t("todo.noDentist"))}
            empty={t("todo.empty")}
          />
        </Panel>
        <Panel
          icon={LayersIcon}
          title={t("todo.byCategoryTitle")}
          description={t("todo.byCategoryDescription")}
        >
          <ShareList
            testId="todo-by-category"
            rows={rows(todo.byCategory, "")}
            empty={t("todo.empty")}
          />
        </Panel>
      </div>
    </div>
  )
}

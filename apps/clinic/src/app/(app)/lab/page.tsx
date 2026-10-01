import {
  AlarmClockIcon,
  CheckCheckIcon,
  FlaskConicalIcon,
  PackageCheckIcon,
  SendIcon,
} from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { FilterBar } from "@/components/filter-bar"
import { Panel } from "@/components/panel"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { LabCasesTable } from "@/features/lab/components/lab-cases-table"
import { getLabFormOptions, getLabSummary, listLabCases } from "@/features/lab/data"
import { LAB_FILTERS, labCaseSearchSchema } from "@/features/lab/schemas"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lab")
  return { title: t("title") }
}

export default async function LabPage({ searchParams }: PageProps<"/lab">) {
  const user = await requirePagePermission("lab:read")
  const { q, status } = labCaseSearchSchema.parse(await searchParams)
  const canWrite = hasPermission(user.role, "lab:write")
  const [summary, { rows, today }, options, t] = await Promise.all([
    getLabSummary(),
    listLabCases({ q, status }),
    canWrite ? getLabFormOptions() : null,
    getTranslations("lab"),
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("stats.atLab")}
          value={summary.atLab}
          icon={SendIcon}
          iconClassName="bg-blue-50 text-blue-600"
          note={t("stats.atLabNote")}
        />
        <StatCard
          title={t("stats.late")}
          value={summary.late}
          icon={AlarmClockIcon}
          iconClassName="bg-red-50 text-red-600"
          note={t("stats.lateNote")}
        />
        <StatCard
          title={t("stats.waiting")}
          value={summary.waiting}
          icon={PackageCheckIcon}
          iconClassName="bg-purple-50 text-purple-600"
          note={t("stats.waitingNote")}
        />
        <StatCard
          title={t("stats.fitted")}
          value={summary.fitted}
          icon={CheckCheckIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("stats.fittedNote")}
        />
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent>
          <FilterBar
            q={q}
            placeholder={t("searchPlaceholder")}
            hint={t("searchHint")}
            filter={{
              param: "status",
              label: t("filter"),
              value: status,
              defaultValue: "open",
              options: LAB_FILTERS.map((f) => ({ value: f, label: t(`filters.${f}`) })),
            }}
          />
        </CardContent>
      </Card>

      <Panel
        icon={FlaskConicalIcon}
        title={t("casesTitle", { count: String(rows.length) })}
        description={canWrite ? t("casesDescription") : undefined}
        className="min-w-0"
        contentClassName="p-0"
      >
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">{t("noCases")}</p>
        ) : (
          <LabCasesTable rows={rows} today={today} options={options} />
        )}
      </Panel>
    </div>
  )
}

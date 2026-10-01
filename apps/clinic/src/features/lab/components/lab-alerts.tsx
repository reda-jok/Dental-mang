import { AlarmClockIcon } from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import { parseIsoDate } from "@/lib/dates"

import type { LabCaseView } from "../data"
import { DUE_BADGE } from "../display"

/** Dashboard card: lab work that's late or due today. */
export function LabAlerts({ cases, late }: { cases: LabCaseView[]; late: number }) {
  const t = useTranslations("lab")
  const format = useFormatter()
  return (
    <Panel
      icon={AlarmClockIcon}
      title={t("alertsTitle")}
      description={t("alertsDescription", { count: late })}
      className="border-red-200"
      actions={
        <Link href={"/lab?status=late" as Route} className="text-sm text-blue-700 hover:underline">
          {t("alertsAll")}
        </Link>
      }
    >
      <ul className="divide-y divide-slate-100" data-testid="lab-alerts">
        {cases.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <Link
                href={`/patients/${c.patient.id}/lab` as Route}
                className="font-medium hover:underline"
              >
                {c.patient.fullName}
              </Link>
              <p className="text-xs text-slate-500">
                {c.work} · {c.labName}
              </p>
            </div>
            {c.due && (
              <Badge className={DUE_BADGE[c.due]}>
                {t(`due.${c.due}`, {
                  date: format.dateTime(parseIsoDate(c.dueOn)!, {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }),
                })}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

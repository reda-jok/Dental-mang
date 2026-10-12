import { useFormatter, useTranslations } from "next-intl"

import { Amount } from "@/features/printing/components/sheets"
import { formatMoney } from "@/lib/money"

import type { topProcedures } from "../stats"

/** This month's most done procedures as a bar list: one colour, exact numbers beside it. */
export function TopProcedures({ rows }: { rows: ReturnType<typeof topProcedures> }) {
  const t = useTranslations("dashboard")
  const format = useFormatter()
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{t("topProceduresEmpty")}</p>
  }
  return (
    <ol className="space-y-3" data-testid="top-procedures">
      {rows.map((row) => (
        <li key={row.procedureId} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-900">{row.name}</span>
            <span className="shrink-0 text-slate-600">
              {t("timesDone", { count: row.count })} ·{" "}
              <Amount value={formatMoney(row.value, "IQD")} />
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100" aria-hidden>
            <div
              className="bg-steel-600 h-2 rounded-full"
              style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }}
              title={format.number(row.count)}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

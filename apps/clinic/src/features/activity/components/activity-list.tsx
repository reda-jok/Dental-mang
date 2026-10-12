import type { Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"
import { Fragment, type ReactNode } from "react"

import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

import type { ActivityRow } from "../data"
import { SENSITIVE_ACTIONS } from "../rules"

/** The history grouped by clinic day, newest first. */
export async function ActivityList({ rows }: { rows: ActivityRow[] }) {
  const [t, format] = await Promise.all([getTranslations("activity"), getFormatter()])
  // Audit actions and entities are plain text in the database; unknown ones read generically.
  const known = (key: string) => t.has(key as never)
  const text = (key: string, values?: Record<string, string>) => t(key as never, values as never)

  const what = (row: ActivityRow) => {
    if (known(`standalone.${row.action}`)) return text(`standalone.${row.action}`)
    const action = known(`actions.${row.action}`) ? text(`actions.${row.action}`) : row.action
    const entity = known(`entities.${row.entity}`)
      ? text(`entities.${row.entity}`)
      : text("entities.other")
    return t("line", { action, entity })
  }
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>

  const days: { day: string; rows: ActivityRow[] }[] = []
  for (const row of rows) {
    if (days.at(-1)?.day === row.day) days.at(-1)!.rows.push(row)
    else days.push({ day: row.day, rows: [row] })
  }

  return (
    <div className="divide-y">
      {days.map(({ day, rows }) => (
        <section key={day}>
          <h3 className="bg-muted/50 text-muted-foreground px-4 py-2 text-sm font-medium">
            {format.dateTime(parseIsoDate(day)!, { dateStyle: "full", timeZone: "UTC" })}
          </h3>
          <ul className="divide-y">
            {rows.map((row) => {
              const facts: ReactNode[] = [
                row.person ?? t("someone"),
                row.patient?.name && (
                  <Link
                    href={`/patients/${row.patient.id}` as Route}
                    className="text-primary hover:underline"
                  >
                    {row.patient.name}
                  </Link>
                ),
                row.amount && money(row.amount),
                row.difference &&
                  t.rich("difference", {
                    amount: formatMoney(row.difference, "IQD"),
                    ltr: (chunks) => <span dir="ltr">{chunks}</span>,
                  }),
                row.reason && t("reason", { reason: row.reason }),
                row.username && t("username", { username: row.username }),
                row.ip && t("ip", { ip: row.ip }),
              ].filter(Boolean)
              return (
                <li key={row.id} className="flex gap-3 px-4 py-3" data-testid="activity-row">
                  <time
                    dateTime={row.at.toISOString()}
                    className="text-muted-foreground shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
                  >
                    {format.dateTime(row.at, { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-medium",
                        (SENSITIVE_ACTIONS as readonly string[]).includes(row.action) &&
                          "text-destructive",
                      )}
                    >
                      {what(row)}
                      {row.number && (
                        <span className="text-muted-foreground ms-2 font-normal">
                          <bdi>{row.number}</bdi>
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm break-words">
                      {facts.map((fact, i) => (
                        <Fragment key={i}>
                          {i > 0 && " · "}
                          {fact}
                        </Fragment>
                      ))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

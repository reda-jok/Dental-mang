import { ChartColumnIcon, ListChecksIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { FilterBar } from "@/components/filter-bar"
import { Panel } from "@/components/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ShareList } from "@/features/accounting/components/share-list"
import { MonthNav } from "@/features/hr/components/month-nav"
import { getWorkByDentist } from "@/features/treatments/data"
import { workParams } from "@/features/treatments/schemas"
import { normalizeArabic, searchTokens } from "@/lib/arabic"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, subtractAmounts } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("treatments")
  return { title: t("tabs.work") }
}

export default async function WorkByDentistPage({ searchParams }: PageProps<"/treatments/work">) {
  await requirePagePermission("treatments:reports")
  const params = workParams.parse(await searchParams)
  const [work, t, format] = await Promise.all([
    getWorkByDentist(params.month),
    getTranslations("treatments"),
    getFormatter(),
  ])
  const percent = (p: number) =>
    format.number(p / 100, { style: "percent", maximumFractionDigits: 1 })
  const dentist = (name: string | null) => name ?? t("work.noDentist")
  // ponytail: filtered in memory: one month of treatments at a time.
  const query = searchTokens(params.q ?? "")
  const shown = work.rows.filter((r) => {
    if (params.dentist && (r.dentistId ?? "none") !== params.dentist) return false
    const text = normalizeArabic(`${r.patient.fullName} ${r.patient.code} ${r.procedureName}`)
    return query.every((token) => text.includes(token))
  })

  return (
    <div className="space-y-6">
      <Panel
        icon={ChartColumnIcon}
        title={t("work.title")}
        description={t("work.description")}
        actions={<MonthNav path="/treatments/work" month={work.month} />}
      >
        <ShareList
          testId="work-by-dentist"
          empty={t("work.empty")}
          rows={work.byDentist.map((d) => ({
            key: d.key,
            label: dentist(d.label),
            amount: d.amount,
            bar: d.bar,
            percent: percent(d.percent),
            detail: t("work.treatmentsCount", { count: d.count }),
          }))}
        />
      </Panel>

      {work.rows.length > 0 && (
        <Panel icon={ListChecksIcon} title={t("work.listTitle")}>
          <div className="space-y-4">
            <FilterBar
              q={params.q ?? ""}
              placeholder={t("work.searchPlaceholder")}
              hint={t("work.searchHint")}
              filter={{
                param: "dentist",
                label: t("columns.dentist"),
                value: params.dentist ?? "all",
                defaultValue: "all",
                options: [
                  { value: "all", label: t("work.allDentists") },
                  ...work.byDentist.map((d) => ({ value: d.key, label: dentist(d.label) })),
                ],
              }}
              keep={{ month: work.month }}
            />
            {shown.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t("work.emptyFiltered")}
              </p>
            ) : (
              <div className="min-w-0 overflow-x-auto rounded-xl border">
                <Table data-testid="work-list">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden ps-4 sm:table-cell">
                        {t("columns.day")}
                      </TableHead>
                      <TableHead className="ps-4 sm:ps-2">{t("columns.treatment")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("columns.patient")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("columns.dentist")}</TableHead>
                      <TableHead className="w-0 text-end">{t("columns.value")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((r) => {
                      const day = format.dateTime(parseIsoDate(r.day)!, {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })
                      return (
                        <TableRow key={r.id} data-work={r.id}>
                          <TableCell className="hidden ps-4 sm:table-cell">{day}</TableCell>
                          <TableCell className="ps-4 whitespace-normal sm:ps-2">
                            {r.procedureName}
                            {r.tooth && (
                              <span className="text-muted-foreground ms-2 text-xs">
                                {t("tooth", { tooth: String(r.tooth) })}
                              </span>
                            )}
                            <span className="text-muted-foreground block text-xs md:hidden">
                              <span className="sm:hidden">{day} · </span>
                              {r.patient.fullName} · {dentist(r.dentistName)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden whitespace-normal md:table-cell">
                            <Link
                              href={`/patients/${r.patient.id}/plans` as Route}
                              className="hover:underline"
                            >
                              {r.patient.fullName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                            {dentist(r.dentistName)}
                          </TableCell>
                          <TableCell className="text-end font-medium">
                            <bdi>{formatMoney(subtractAmounts(r.price, r.discount), "IQD")}</bdi>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}

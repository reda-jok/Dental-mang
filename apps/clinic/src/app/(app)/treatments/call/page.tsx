import { ExternalLinkIcon, PhoneCallIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { FilterBar } from "@/components/filter-bar"
import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/features/patients/components/pagination"
import { getClinicSettings } from "@/features/settings/data"
import { FollowUpButton } from "@/features/treatments/components/follow-up-button"
import { listPlansToCall, type PlanToCallRow } from "@/features/treatments/data"
import { daysBetween } from "@/features/treatments/rules"
import { plansToCallParams } from "@/features/treatments/schemas"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("treatments")
  return { title: t("tabs.call") }
}

export default async function PlansToCallPage({ searchParams }: PageProps<"/treatments/call">) {
  await requirePagePermission("treatments:read")
  const params = plansToCallParams.parse(await searchParams)
  const [{ rows, total, pageCount, today }, clinic, t, format] = await Promise.all([
    listPlansToCall(params),
    getClinicSettings(),
    getTranslations("treatments"),
    getFormatter(),
  ])
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
  const nextStep = (row: PlanToCallRow) =>
    row.next
      .map((n) =>
        n.tooth
          ? `${n.procedureName} (${t("tooth", { tooth: String(n.tooth) })})`
          : n.procedureName,
      )
      .join("، ") || null
  const hrefFor = (page: number) => {
    const search = new URLSearchParams({ page: String(page) })
    if (params.q) search.set("q", params.q)
    return `/treatments/call?${search}`
  }

  return (
    <Panel
      icon={PhoneCallIcon}
      title={t("call.title")}
      description={t("call.description")}
      actions={
        <span className="text-muted-foreground text-sm">{t("call.count", { count: total })}</span>
      }
    >
      <div className="space-y-4">
        <FilterBar q={params.q ?? ""} placeholder={t("searchPlaceholder")} hint={t("searchHint")} />
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {params.q ? t("call.emptyFiltered") : t("call.empty")}
          </p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border">
            <Table data-testid="plans-to-call">
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">{t("columns.patient")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("call.next")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("call.lastVisit")}</TableHead>
                  <TableHead className="hidden w-0 text-end sm:table-cell">
                    {t("columns.left")}
                  </TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const step = nextStep(row)
                  const days = daysBetween(row.since, today)
                  return (
                    <TableRow key={row.id} data-plan={row.id}>
                      <TableCell className="ps-4 whitespace-normal">
                        <span className="font-medium">{row.patient.fullName}</span>
                        <span className="text-muted-foreground block text-xs">
                          <bdi className="whitespace-nowrap">{row.patient.code}</bdi>
                          {row.patient.phone && (
                            <span className="ms-2 whitespace-nowrap">
                              <bdi>{formatLocalPhone(row.patient.phone)}</bdi>
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground block text-xs">{row.title}</span>
                        {step && (
                          <span className="text-muted-foreground block text-xs md:hidden">
                            {step}
                          </span>
                        )}
                        {/* Phones: the last visit here too. */}
                        <span className="block text-xs sm:hidden">
                          {row.lastVisit ? day(row.lastVisit) : t("call.neverVisited")} ·{" "}
                          {t("call.daysAgo", { days })}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm whitespace-normal md:table-cell">
                        {step ?? "—"}
                        <span className="text-muted-foreground block text-xs">
                          {t("progress", { done: String(row.done), total: String(row.total) })}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">
                        {row.lastVisit ? day(row.lastVisit) : t("call.neverVisited")}
                        <span className="text-muted-foreground block text-xs" data-days={days}>
                          {t("call.daysAgo", { days })}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-end font-medium sm:table-cell">
                        <bdi>{formatMoney(row.left, "IQD")}</bdi>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <FollowUpButton
                            patient={row.patient}
                            nextTreatment={step}
                            clinic={{ name: clinic?.name ?? "", phone: clinic?.phone ?? null }}
                          />
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/patients/${row.patient.id}/plans` as Route}
                              aria-label={t("call.openPlan", { name: row.patient.fullName })}
                              title={t("call.openPlan", { name: row.patient.fullName })}
                            >
                              <ExternalLinkIcon />
                            </Link>
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination page={params.page} pageCount={pageCount} hrefFor={hrefFor} />
      </div>
    </Panel>
  )
}

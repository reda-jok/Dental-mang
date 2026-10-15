import { ClipboardListIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { FilterBar } from "@/components/filter-bar"
import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/features/patients/components/pagination"
import { listOpenPlans } from "@/features/treatments/data"
import { openPlansParams } from "@/features/treatments/schemas"
import { formatMoney } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("treatments")
  return { title: t("tabs.open") }
}

const STATUS_VARIANT = { proposed: "outline", accepted: "secondary" } as const

export default async function OpenPlansPage({ searchParams }: PageProps<"/treatments">) {
  await requirePagePermission("treatments:read")
  const params = openPlansParams.parse(await searchParams)
  const [{ rows, total, pageCount }, t, format] = await Promise.all([
    listOpenPlans(params),
    getTranslations("treatments"),
    getFormatter(),
  ])
  const money = (v: string) => <bdi>{formatMoney(v, "IQD")}</bdi>
  const hrefFor = (page: number) => {
    const search = new URLSearchParams({ page: String(page) })
    if (params.q) search.set("q", params.q)
    if (params.status) search.set("status", params.status)
    return `/treatments?${search}`
  }

  return (
    <Panel
      icon={ClipboardListIcon}
      title={t("open.title")}
      description={t("open.description")}
      actions={
        <span className="text-muted-foreground text-sm">{t("open.count", { count: total })}</span>
      }
    >
      <div className="space-y-4">
        <FilterBar
          q={params.q ?? ""}
          placeholder={t("searchPlaceholder")}
          hint={t("searchHint")}
          filter={{
            param: "status",
            label: t("status"),
            value: params.status ?? "all",
            defaultValue: "all",
            options: [
              { value: "all", label: t("allStatuses") },
              { value: "accepted", label: t("statuses.accepted") },
              { value: "proposed", label: t("statuses.proposed") },
            ],
          }}
        />
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {params.q || params.status ? t("open.emptyFiltered") : t("open.empty")}
          </p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border">
            <Table data-testid="open-plans">
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">{t("columns.patient")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("columns.plan")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("columns.progress")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("columns.dentists")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("columns.nextVisit")}</TableHead>
                  <TableHead className="w-0 text-end">{t("columns.left")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((plan) => (
                  <TableRow key={plan.id} data-plan={plan.id}>
                    <TableCell className="ps-4 whitespace-normal">
                      <Link
                        href={`/patients/${plan.patient.id}/plans` as Route}
                        className="font-medium hover:underline"
                      >
                        {plan.patient.fullName}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        <bdi>{plan.patient.code}</bdi>
                      </span>
                      {/* Phones: the plan and its progress under the patient. */}
                      <span className="text-muted-foreground block text-xs md:hidden">
                        {plan.title} ·{" "}
                        {t("progress", { done: String(plan.done), total: String(plan.total) })}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell">
                      <span className="me-2">{plan.title}</span>
                      <Badge variant={STATUS_VARIANT[plan.status as keyof typeof STATUS_VARIANT]}>
                        {t(`statuses.${plan.status as keyof typeof STATUS_VARIANT}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 w-20 rounded-full" aria-hidden>
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{
                              width: `${plan.total ? Math.round((plan.done / plan.total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {t("progress", { done: String(plan.done), total: String(plan.total) })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm whitespace-normal lg:table-cell">
                      {plan.dentists.join("، ") || "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {plan.nextVisit ? (
                        format.dateTime(plan.nextVisit, { day: "numeric", month: "short" })
                      ) : (
                        <span className="text-muted-foreground">{t("noVisit")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end font-medium">{money(plan.left)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination page={params.page} pageCount={pageCount} hrefFor={hrefFor} />
      </div>
    </Panel>
  )
}

import {
  AlertCircleIcon,
  ClipboardListIcon,
  HourglassIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InvoiceFilters } from "@/features/billing/components/invoice-filters"
import { InvoicesTable } from "@/features/billing/components/invoices-table"
import { getBillingSummary, listInvoices } from "@/features/billing/data"
import { invoiceSearchSchema } from "@/features/billing/schemas"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { Pagination } from "@/features/patients/components/pagination"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing")
  return { title: t("title") }
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePagePermission("billing:read")
  const { q, status, page } = invoiceSearchSchema.parse(await searchParams)
  const [summary, { rows, total, pageCount }, t, format] = await Promise.all([
    getBillingSummary(),
    listInvoices({ q, status, page }),
    getTranslations("billing"),
    getFormatter(),
  ])
  const canWrite = hasPermission(user.role, "billing:write")
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>

  const hrefFor = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status !== "all") params.set("status", status)
    if (p > 1) params.set("page", String(p))
    return params.size ? `/billing?${params}` : "/billing"
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("stats.month")}
          value={money(summary.monthTotal)}
          icon={ReceiptTextIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("stats.monthNote", { count: summary.monthCount })}
        />
        <StatCard
          title={t("stats.outstanding")}
          value={money(summary.outstanding)}
          icon={WalletIcon}
          iconClassName="bg-yellow-50 text-yellow-600"
          note={t("stats.outstandingNote", { count: summary.outstandingCount })}
        />
        <StatCard
          title={t("stats.overdue")}
          value={money(summary.overdue)}
          icon={AlertCircleIcon}
          iconClassName="bg-red-50 text-red-600"
          note={t("stats.overdueNote")}
        />
        <StatCard
          title={t("stats.unbilled")}
          value={format.number(summary.unbilledItems)}
          icon={HourglassIcon}
          iconClassName="bg-blue-50 text-blue-600"
          note={t("stats.unbilledNote")}
        />
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent>
          <InvoiceFilters q={q} status={status} />
        </CardContent>
      </Card>

      {/* Side by side only on wide screens: the table needs the room. */}
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <Panel
          icon={ReceiptTextIcon}
          title={t("listTitle", { total: String(total) })}
          className="min-w-0 2xl:col-span-2"
          contentClassName="p-0"
        >
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-slate-700">
                {q || status !== "all" ? t("emptyFiltered") : t("empty")}
              </p>
              {!q && status === "all" && <p className="text-sm text-slate-400">{t("emptyHint")}</p>}
            </div>
          ) : (
            <>
              <InvoicesTable rows={rows} />
              <div className="border-t px-4 py-3">
                <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
              </div>
            </>
          )}
        </Panel>

        <Panel
          as="h2"
          icon={ClipboardListIcon}
          title={t("unbilledTitle")}
          description={t("unbilledDescription")}
          className="min-w-0"
          contentClassName="p-3"
        >
          {summary.unbilledPatients.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">{t("unbilledNone")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.unbilledPatients.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {t("unbilledCount", { count: p.items })} · {money(p.amount)}
                    </p>
                  </div>
                  {canWrite && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/patients/${p.id}/billing?new=visit` as Route}>
                        {t("issueFor")}
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

import {
  CalendarClockIcon,
  HandCoinsIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { z } from "zod"

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
import { StatCard } from "@/features/dashboard/components/stat-card"
import {
  LabAdjustmentButton,
  LabPaymentButton,
  LabPaymentVoidButton,
} from "@/features/lab/components/lab-money"
import { StatementControls } from "@/features/lab/components/statement-controls"
import { getLabAccounts, getLabChoices, getLabStatement } from "@/features/lab/data"
import { labStatementSearchSchema } from "@/features/lab/schemas"
import { PrintLink } from "@/features/printing/components/print-link"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import { can } from "@/server/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lab")
  return { title: t("tabs.accounts") }
}

export default async function LabStatementPage({
  params,
  searchParams,
}: PageProps<"/lab/accounts/[labId]">) {
  const user = await requirePagePermission("lab:pay")
  const { labId } = await params
  if (!z.uuid().safeParse(labId).success) notFound()
  const { month } = labStatementSearchSchema.parse(await searchParams)
  const [statement, labs, accounts, canVoid, t, format] = await Promise.all([
    getLabStatement(labId, month),
    getLabChoices(),
    getLabAccounts(),
    can(user, "billing:void"),
    getTranslations("lab"),
    getFormatter(),
  ])
  if (!statement) notFound()
  const { lab, rows, totals } = statement
  const owedNow = accounts.rows.find((r) => r.id === lab.id)?.owed ?? statement.closing

  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>
  const balance = (amount: string) =>
    toMinor(amount) < 0n ? (
      <span className="text-blue-700" title={t("statement.creditBalance")}>
        {money(amount.slice(1))}+
      </span>
    ) : (
      money(amount)
    )
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "short", timeZone: "UTC" })
  const monthLabel = format.dateTime(parseIsoDate(statement.range.start)!, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const billedCount = rows.filter((r) => r.kind === "bill").length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatementControls
          labId={lab.id}
          labs={labs}
          month={statement.month}
          monthLabel={monthLabel}
          prev={statement.range.prev}
          next={statement.isCurrentMonth ? null : statement.range.next}
        />
        <div className="flex flex-wrap gap-2">
          <LabPaymentButton lab={lab} owed={owedNow} />
          <LabAdjustmentButton lab={lab} />
          <PrintLink
            href={`/print/lab-statement/${lab.id}/${statement.month}`}
            label={t("statement.print")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("statement.opening")}
          value={balance(statement.opening)}
          icon={CalendarClockIcon}
          iconClassName="bg-slate-100 text-slate-600"
          note={t("statement.openingNote")}
        />
        <StatCard
          title={t("statement.billed")}
          value={money(totals.billed)}
          icon={PackageCheckIcon}
          iconClassName="bg-purple-50 text-purple-600"
          note={t("statement.billedNote", { count: billedCount })}
        />
        <StatCard
          title={t("statement.paid")}
          value={money(totals.paid)}
          icon={WalletIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("statement.paidNote")}
        />
        <StatCard
          title={statement.isCurrentMonth ? t("statement.closingNow") : t("statement.closing")}
          value={<span data-testid="statement-closing">{balance(statement.closing)}</span>}
          icon={HandCoinsIcon}
          iconClassName="bg-red-50 text-red-600"
          note={t("statement.closingNote")}
        />
      </div>

      <Panel
        icon={ReceiptTextIcon}
        title={t("statement.title", { name: lab.name })}
        description={t("statement.description")}
        className="min-w-0"
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">{t("statement.columns.date")}</TableHead>
                <TableHead>{t("statement.columns.document")}</TableHead>
                <TableHead>{t("statement.columns.details")}</TableHead>
                <TableHead className="text-end">{t("statement.columns.added")}</TableHead>
                <TableHead className="text-end">{t("statement.columns.deducted")}</TableHead>
                <TableHead className="text-end">{t("statement.columns.balance")}</TableHead>
                <TableHead className="pe-6">
                  <span className="sr-only">{t("statement.columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-slate-50/60">
                <TableCell className="ps-6 whitespace-nowrap">
                  {day(statement.range.start)}
                </TableCell>
                <TableCell colSpan={4} className="text-sm text-slate-600">
                  {t("statement.openingRow")}
                </TableCell>
                <TableCell className="text-end font-medium whitespace-nowrap">
                  {balance(statement.opening)}
                </TableCell>
                <TableCell className="pe-6" />
              </TableRow>
              {rows.map((row) => {
                const adds = row.kind === "bill" || row.kind === "charge"
                return (
                  <TableRow
                    key={`${row.kind}-${row.id}`}
                    data-entry={row.number ?? row.kind}
                    className={cn(row.voided && "text-slate-400")}
                  >
                    <TableCell className="ps-6 whitespace-nowrap">{day(row.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="text-xs text-slate-500">{t(`statement.kinds.${row.kind}`)}</p>
                      {row.number && <bdi className="font-mono text-sm">{row.number}</bdi>}
                    </TableCell>
                    <TableCell className="min-w-56">
                      {row.kind === "bill" && row.patient && (
                        <>
                          <Link
                            href={`/patients/${row.patient.id}/lab`}
                            className="font-medium hover:underline"
                          >
                            {row.patient.fullName}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {row.work}
                            {row.teeth && row.teeth.length > 0 && (
                              <span className="ms-2">
                                {t("statement.teeth", { teeth: row.teeth.join(", ") })}
                              </span>
                            )}
                          </p>
                        </>
                      )}
                      {row.kind === "payment" && (
                        <>
                          <p>
                            {t(`pay.methods.${row.method === "wallet" ? "wallet" : "cash"}`)}
                            {row.reference && (
                              <span className="ms-2 text-xs text-slate-500">
                                <bdi>{row.reference}</bdi>
                              </span>
                            )}
                            {row.voided && (
                              <Badge variant="destructive" className="ms-2">
                                {t("statement.voided")}
                              </Badge>
                            )}
                          </p>
                          {row.reason && (
                            <p className="text-xs text-slate-500">
                              {row.voided
                                ? t("statement.voidedReason", { reason: row.reason })
                                : row.reason}
                            </p>
                          )}
                          {row.paidByName && (
                            <p className="text-xs text-slate-400">
                              {t("statement.paidBy", { name: row.paidByName })}
                            </p>
                          )}
                        </>
                      )}
                      {(row.kind === "discount" || row.kind === "charge") && (
                        <p className="text-sm">{row.reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {adds && money(row.amount)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-end whitespace-nowrap",
                        row.voided ? "line-through" : "text-green-700",
                      )}
                    >
                      {!adds && money(row.amount)}
                    </TableCell>
                    <TableCell className="text-end font-medium whitespace-nowrap">
                      {balance(row.balance)}
                    </TableCell>
                    <TableCell className="pe-6">
                      {row.kind === "payment" && !row.voided && row.number && (
                        <LabPaymentVoidButton id={row.id} number={row.number} allowed={canVoid} />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {rows.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-slate-500">{t("statement.empty")}</p>
        )}
        {(toMinor(totals.charged) > 0n || toMinor(totals.discounted) > 0n) && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 px-6 py-3 text-sm text-slate-600">
            {toMinor(totals.charged) > 0n && (
              <div className="flex gap-2">
                <dt>{t("statement.totals.charged")}</dt>
                <dd className="font-medium">{money(totals.charged)}</dd>
              </div>
            )}
            {toMinor(totals.discounted) > 0n && (
              <div className="flex gap-2">
                <dt>{t("statement.totals.discounted")}</dt>
                <dd className="font-medium">{money(totals.discounted)}</dd>
              </div>
            )}
          </dl>
        )}
      </Panel>
    </div>
  )
}

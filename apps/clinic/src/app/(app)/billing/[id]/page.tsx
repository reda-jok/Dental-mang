import { ArrowRightIcon, ReceiptTextIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { InfoHint } from "@/components/info-hint"
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
import { InvoiceStateBadge } from "@/features/billing/components/invoice-state-badge"
import { VoidInvoiceButton } from "@/features/billing/components/void-invoice-button"
import { getInvoice } from "@/features/billing/data"
import { toothText } from "@/features/billing/display"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing")
  return { title: t("title") }
}

export default async function InvoicePage({ params }: PageProps<"/billing/[id]">) {
  await requirePagePermission("billing:read")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [invoice, t, format] = await Promise.all([
    getInvoice(id),
    getTranslations("billing"),
    getFormatter(),
  ])
  if (!invoice) notFound()

  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { dateStyle: "long", timeZone: "UTC" })
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>
  const isVoid = invoice.status === "void"

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/billing">
          <ArrowRightIcon className="ltr:rotate-180" />
          {t("backToList")}
        </Link>
      </Button>

      <Panel
        icon={ReceiptTextIcon}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <bdi className="font-mono">{invoice.number}</bdi>
            <InvoiceStateBadge state={invoice.state} />
          </span>
        }
        description={t(`kinds.${invoice.kind}`)}
        actions={
          !isVoid && (
            <VoidInvoiceButton id={invoice.id} number={invoice.number} allowed={invoice.canVoid} />
          )
        }
        className="min-w-0"
      >
        <div className="space-y-6">
          {isVoid && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-medium">
                {t("voidedInfo", { name: invoice.voidedByName ?? "—" })}
                {invoice.voidedAt &&
                  ` · ${format.dateTime(invoice.voidedAt, { dateStyle: "long" })}`}
              </p>
              <p>
                {t("voidReasonLabel")}: {invoice.voidReason}
              </p>
            </div>
          )}

          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">{t("patient")}</dt>
              <dd>
                <Link
                  href={`/patients/${invoice.patient.id}/billing` as Route}
                  className="font-medium hover:underline"
                >
                  {invoice.patient.fullName}
                </Link>
                <span className="ms-2 font-mono text-xs text-slate-500">
                  <bdi>{invoice.patient.code}</bdi>
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("issueDate")}</dt>
              <dd>{day(invoice.issueDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("dueDate")}</dt>
              <dd>{day(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("createdBy")}</dt>
              <dd>{invoice.createdByName ?? "—"}</dd>
            </div>
            {invoice.plan && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t("fromPlan")}</dt>
                <dd>{invoice.plan.title}</dd>
              </div>
            )}
          </dl>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">{t("line")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("dentist")}</TableHead>
                  <TableHead className="hidden text-end sm:table-cell">{t("unitPrice")}</TableHead>
                  <TableHead className="hidden text-end sm:table-cell">{t("discount")}</TableHead>
                  <TableHead className="text-end">{t("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => {
                  const tooth = toothText(line.tooth, line.surfaces)
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="ps-4">
                        <span className="font-medium">{line.description}</span>
                        {tooth && (
                          <span className="ms-2 text-xs text-slate-500">
                            {t("toothLabel", { tooth })}
                          </span>
                        )}
                        {line.quantity > 1 && (
                          <span className="ms-2 text-xs text-slate-500" dir="ltr">
                            × {line.quantity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {line.dentistName ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-end whitespace-nowrap sm:table-cell">
                        {money(line.unitPrice)}
                      </TableCell>
                      <TableCell className="hidden text-end whitespace-nowrap text-green-700 sm:table-cell">
                        {line.discount === "0" ? "—" : money(line.discount)}
                      </TableCell>
                      <TableCell className="text-end font-medium whitespace-nowrap">
                        {money(line.total)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-600">
              {invoice.notes && <p className="whitespace-pre-line">{invoice.notes}</p>}
              {invoice.journalNumber && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  {t("journal")}: <bdi className="font-mono">{invoice.journalNumber}</bdi>
                  {invoice.reversalNumber &&
                    ` · ${t("journalReversed", { number: invoice.reversalNumber })}`}
                  <InfoHint>{t("journalHint")}</InfoHint>
                </p>
              )}
            </div>
            <dl className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between">
                <dt>{t("subtotal")}</dt>
                <dd>{money(invoice.subtotal)}</dd>
              </div>
              {invoice.discountTotal !== "0" && (
                <div className="flex justify-between text-green-700">
                  <dt>{t("discounts")}</dt>
                  <dd>{money(invoice.discountTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>{t("total")}</dt>
                <dd data-testid="invoice-total">{money(invoice.total)}</dd>
              </div>
              {!isVoid && (
                <>
                  <div className="flex justify-between">
                    <dt>{t("paid")}</dt>
                    <dd>{money(invoice.paid)}</dd>
                  </div>
                  <div className="flex justify-between font-medium text-red-700">
                    <dt>{t("balance")}</dt>
                    <dd>{money(invoice.balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      </Panel>
    </div>
  )
}

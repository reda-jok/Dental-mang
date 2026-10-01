import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, subtractAmounts, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"

import type { PatientBilling, PaymentRow } from "../data"
import { sumAmounts } from "../payments"
import { PrintLink } from "../../printing/components/print-link"
import { VoidButton } from "./void-button"

/** A patient's payments: what each paid, and which invoices it went to. */
export function PaymentsTable({ rows, canVoid }: { rows: PaymentRow[]; canVoid: boolean }) {
  const t = useTranslations("billing")
  const tp = useTranslations("print")
  const format = useFormatter()
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "short", timeZone: "UTC" })

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("paymentColumns.number")}</TableHead>
            <TableHead>{t("paymentColumns.method")}</TableHead>
            <TableHead className="text-end">{t("paymentColumns.amount")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("paymentColumns.applied")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("paymentColumns.by")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.state")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const unapplied = subtractAmounts(
              p.amount,
              sumAmounts(p.appliedTo.map((a) => a.amount)),
            )
            return (
              <TableRow
                key={p.id}
                data-payment={p.number}
                className={cn(p.voidedAt && "text-slate-400")}
              >
                <TableCell className="ps-6">
                  <bdi className="font-mono text-sm font-medium">{p.number}</bdi>
                  <p className="text-xs text-slate-500">{day(p.receivedOn)}</p>
                </TableCell>
                <TableCell>
                  {t(`methods.${p.method}`)}
                  {p.reference && (
                    <span className="ms-2 font-mono text-xs text-slate-500">
                      <bdi>{p.reference}</bdi>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-end font-medium whitespace-nowrap">
                  <span dir="ltr" className={cn(p.voidedAt && "line-through")}>
                    {formatMoney(p.amount, "IQD")}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {p.voidedAt ? (
                    <span className="text-red-600">
                      {t("paymentVoided", { reason: p.voidReason ?? "" })}
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {p.appliedTo.map((a) => (
                        <Link
                          key={a.id}
                          href={`/billing/${a.id}` as Route}
                          className="hover:underline"
                        >
                          <bdi className="font-mono text-xs">{a.number}</bdi>{" "}
                          <span dir="ltr" className="text-xs text-slate-500">
                            {formatMoney(a.amount, "IQD")}
                          </span>
                        </Link>
                      ))}
                      {toMinor(unapplied) > 0n && (
                        <span className="text-xs text-blue-700">
                          {t("unapplied")} <span dir="ltr">{formatMoney(unapplied, "IQD")}</span>
                        </span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{p.receivedByName ?? "—"}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <PrintLink
                      href={`/print/receipt/${p.id}`}
                      label={tp("printReceiptOf", { number: p.number })}
                      compact
                    />
                    {!p.voidedAt && (
                      <VoidButton
                        kind="payment"
                        id={p.id}
                        number={p.number}
                        allowed={canVoid}
                        compact
                      />
                    )}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function RefundsTable({ rows }: { rows: PatientBilling["refunds"] }) {
  const t = useTranslations("billing")
  const format = useFormatter()
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("refundColumns.number")}</TableHead>
            <TableHead>{t("refundColumns.method")}</TableHead>
            <TableHead className="text-end">{t("refundColumns.amount")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("refundColumns.reason")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("refundColumns.by")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-refund={r.number}>
              <TableCell className="ps-6">
                <bdi className="font-mono text-sm font-medium">{r.number}</bdi>
                <p className="text-xs text-slate-500">
                  {format.dateTime(parseIsoDate(r.refundedOn)!, {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </p>
              </TableCell>
              <TableCell>{t(`methods.${r.method}`)}</TableCell>
              <TableCell className="text-end font-medium whitespace-nowrap text-red-700">
                <span dir="ltr">{formatMoney(r.amount, "IQD")}</span>
              </TableCell>
              <TableCell className="hidden max-w-64 truncate md:table-cell">{r.reason}</TableCell>
              <TableCell className="hidden lg:table-cell">{r.refundedByName ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

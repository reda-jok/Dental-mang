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
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

import type { InvoiceListRow } from "../data"
import { InvoiceStateBadge } from "./invoice-state-badge"

/** Invoice rows; the whole row opens the invoice. `showPatient` is off on a patient's own tab. */
export function InvoicesTable({
  rows,
  showPatient = true,
}: {
  rows: InvoiceListRow[]
  showPatient?: boolean
}) {
  const t = useTranslations("billing")
  const format = useFormatter()
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "short", timeZone: "UTC" })

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("columns.number")}</TableHead>
            <TableHead>{showPatient ? t("columns.patient") : t("columns.items")}</TableHead>
            <TableHead className="text-end">{t("columns.total")}</TableHead>
            <TableHead className="hidden text-end sm:table-cell">{t("columns.balance")}</TableHead>
            <TableHead>{t("columns.state")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              data-invoice={row.number}
              className={cn("relative", row.state === "void" && "text-slate-400")}
            >
              <TableCell className="ps-6">
                {/* The link covers the whole row. */}
                <Link
                  href={`/billing/${row.id}` as Route}
                  aria-label={t("open", { number: row.number })}
                  className="font-mono text-sm font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                >
                  <bdi>{row.number}</bdi>
                </Link>
                <p className="text-xs text-slate-500">
                  {day(row.issueDate)} · {t(`kinds.${row.kind}`)}
                </p>
              </TableCell>
              <TableCell className="max-w-64">
                {showPatient && <p className="truncate font-medium">{row.patient.fullName}</p>}
                {/* What was billed: the first treatment, and how many more. */}
                <p className={cn("truncate", showPatient && "text-xs text-slate-500")}>
                  {row.summary}
                  {row.moreLines > 0 && (
                    <span className="ms-1 text-xs text-slate-500">
                      {t("moreLines", { count: String(row.moreLines) })}
                    </span>
                  )}
                </p>
              </TableCell>
              <TableCell className="text-end font-medium whitespace-nowrap">
                <span dir="ltr">{formatMoney(row.total, "IQD")}</span>
              </TableCell>
              <TableCell className="hidden text-end whitespace-nowrap sm:table-cell">
                <span dir="ltr">{formatMoney(row.balance, "IQD")}</span>
              </TableCell>
              <TableCell>
                <InvoiceStateBadge state={row.state} />
                {(row.state === "unpaid" || row.state === "partial") && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("dueOn", { date: day(row.dueDate) })}
                  </p>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

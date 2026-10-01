"use client"

import type { Route } from "next"
import { useFormatter, useNow, useTranslations } from "next-intl"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
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
import { formatLocalPhone } from "@/lib/validation"

import type { DebtRow } from "../data"
import type { AgeBucket } from "../debts"
import { ReminderButton } from "./reminder-button"

/** Colour per age group: later is redder. */
export const BUCKET_STYLE: Record<AgeBucket, string> = {
  current: "border border-slate-300 bg-slate-50 text-slate-600",
  d1_30: "border border-yellow-500 bg-yellow-50 text-yellow-700",
  d31_60: "border border-orange-500 bg-orange-50 text-orange-700",
  d61_90: "border border-red-400 bg-red-50 text-red-700",
  d90plus: "border border-red-700 bg-red-100 text-red-800",
}

export function DebtsTable({
  rows,
  clinic,
}: {
  rows: DebtRow[]
  clinic: { name: string; phone: string | null }
}) {
  const t = useTranslations("billing")
  const format = useFormatter()
  const now = useNow()
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("debtColumns.patient")}</TableHead>
            <TableHead className="text-end">{t("debtColumns.overdue")}</TableHead>
            <TableHead>{t("debtColumns.late")}</TableHead>
            <TableHead className="hidden text-end md:table-cell">{t("debtColumns.owed")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("debtColumns.lastPaid")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("debtColumns.reminded")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("debtColumns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.patientId} data-debt={row.patient.fullName}>
              <TableCell className="ps-6">
                <Link
                  href={`/patients/${row.patientId}/billing` as Route}
                  className="font-medium hover:underline"
                >
                  {row.patient.fullName}
                </Link>
                <p className="text-xs text-slate-500">
                  <bdi className="font-mono">{row.patient.code}</bdi>
                  {row.patient.phone && (
                    <span className="ms-2">
                      <bdi>{formatLocalPhone(row.patient.phone)}</bdi>
                    </span>
                  )}
                </p>
              </TableCell>
              <TableCell className="text-end font-semibold whitespace-nowrap text-red-700">
                {money(row.overdue)}
              </TableCell>
              <TableCell>
                <Badge className={cn(BUCKET_STYLE[row.worst])}>
                  {t("daysLate", { count: row.daysLate })}
                </Badge>
                <p className="mt-1 text-xs text-slate-500">{t(`buckets.${row.worst}`)}</p>
              </TableCell>
              <TableCell className="hidden text-end whitespace-nowrap md:table-cell">
                {money(row.owed)}
              </TableCell>
              <TableCell className="hidden text-sm lg:table-cell">
                {row.lastPaidOn
                  ? format.dateTime(parseIsoDate(row.lastPaidOn)!, {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })
                  : t("neverPaid")}
              </TableCell>
              <TableCell className="hidden text-sm lg:table-cell">
                {row.lastRemindedAt ? (
                  <span title={t("remindersCount", { count: row.reminders })}>
                    {format.relativeTime(row.lastRemindedAt, now)}
                  </span>
                ) : (
                  <span className="text-slate-400">{t("neverReminded")}</span>
                )}
              </TableCell>
              <TableCell>
                <ReminderButton
                  patient={row.patient}
                  amount={row.overdue}
                  oldestDue={row.oldestDue}
                  clinic={clinic}
                  compact
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

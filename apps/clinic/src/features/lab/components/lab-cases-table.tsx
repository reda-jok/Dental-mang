import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
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

import type { LabCaseView, LabFormOptions } from "../data"
import { DUE_BADGE, STATUS_BADGE } from "../display"
import type { LabStatus } from "../rules"
import { LabCaseButton } from "./lab-case-dialog"
import { LabCaseSteps } from "./lab-case-steps"

/** Lab cases with their state and next steps. `options` (lab:write) enables the steps. */
export function LabCasesTable({
  rows,
  today,
  options,
  showPatient = true,
}: {
  rows: LabCaseView[]
  today: string
  options: LabFormOptions | null
  showPatient?: boolean
}) {
  const t = useTranslations("lab")
  const format = useFormatter()
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "short", timeZone: "UTC" })

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("columns.case")}</TableHead>
            {showPatient && <TableHead>{t("columns.patient")}</TableHead>}
            <TableHead>{t("columns.work")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("columns.lab")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="hidden text-end lg:table-cell">{t("columns.cost")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("columns.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow
              key={c.id}
              data-lab-case={c.number}
              className={cn(c.status === "cancelled" && "opacity-60")}
            >
              <TableCell className="ps-6">
                <bdi className="font-mono text-sm font-medium">{c.number}</bdi>
                <p className="text-xs text-slate-500">
                  {t("sentOnShort", { date: day(c.sentOn) })}
                </p>
              </TableCell>
              {showPatient && (
                <TableCell>
                  <Link
                    href={`/patients/${c.patient.id}/lab` as Route}
                    className="font-medium hover:underline"
                  >
                    {c.patient.fullName}
                  </Link>
                </TableCell>
              )}
              <TableCell className="max-w-56">
                <p className="truncate font-medium">{c.work}</p>
                <p className="text-xs text-slate-500">
                  {c.teeth.length > 0 && <bdi className="font-mono">{c.teeth.join(" ")}</bdi>}
                  {c.shade && <span className="ms-2">{t("shadeShort", { shade: c.shade })}</span>}
                  {c.material && (
                    <span className="ms-2">{t(`materials.${c.material as "zirconia"}`)}</span>
                  )}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {c.labName}
                {c.dentistName && <p className="text-xs text-slate-500">{c.dentistName}</p>}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1">
                  <Badge className={STATUS_BADGE[c.status as LabStatus]}>
                    {t(`statuses.${c.status}`)}
                  </Badge>
                  {c.due && (
                    <Badge className={DUE_BADGE[c.due]}>
                      {t(`due.${c.due}`, { date: day(c.dueOn) })}
                    </Badge>
                  )}
                  {c.remakes > 0 && (
                    <Badge variant="outline">{t("remakes", { count: c.remakes })}</Badge>
                  )}
                </span>
                {c.status === "received" && c.receivedOn && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("receivedOnShort", { date: day(c.receivedOn) })}
                  </p>
                )}
                {c.status === "fitted" && c.fittedOn && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("fittedOnShort", { date: day(c.fittedOn) })}
                  </p>
                )}
                {c.cancelReason && <p className="mt-1 text-xs text-slate-500">{c.cancelReason}</p>}
              </TableCell>
              <TableCell className="hidden text-end whitespace-nowrap lg:table-cell">
                {c.cost === "0" ? "—" : <span dir="ltr">{formatMoney(c.cost, "IQD")}</span>}
              </TableCell>
              <TableCell>
                {options && (
                  <span className="flex items-center gap-1">
                    {c.status === "sent" && <LabCaseButton options={options} labCase={c} />}
                    <LabCaseSteps labCase={c} today={today} />
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

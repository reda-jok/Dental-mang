"use client"

import { CheckCircle2Icon, MessageCircleIcon, PhoneOffIcon } from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatLocalPhone } from "@/lib/validation"
import { reminderMessage } from "@/lib/whatsapp"

import { formatTime, visitPurpose } from "../../appointments/display"
import { useBooking } from "../../appointments/components/booking-provider"
import type { ReminderRow } from "../data"
import { useLogReminder } from "./use-log-reminder"

/** One row per waiting appointment, with a button that opens the WhatsApp reminder. */
export function ReminderList({ rows }: { rows: ReminderRow[] }) {
  const t = useTranslations("reminders")
  const ta = useTranslations("appointments")
  const purpose = (row: ReminderRow) => visitPurpose(row, (r) => ta(`reasons.${r}`))
  const format = useFormatter()
  const { openWhatsApp, config } = useBooking()
  const { log, pending } = useLogReminder()

  const send = (row: ReminderRow) =>
    row.patient.phone &&
    openWhatsApp({
      kind: "reminder",
      phone: row.patient.phone,
      patientName: row.patient.fullName,
      message: reminderMessage({
        clinicName: config.clinicName,
        patientName: row.patient.fullName,
        startsAt: row.startsAt,
        dentistName: row.dentistName,
        procedureName: purpose(row),
        timeZone: config.timeZone,
      }),
      onSent: () => log(row.id),
    })

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li
          key={row.id}
          data-reminder={row.state}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-semibold text-slate-900">
              {formatTime(row.time)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <Link href={`/patients/${row.patient.id}` as Route} className="hover:underline">
                  {row.patient.fullName}
                </Link>
                <span className="ms-2 text-xs text-slate-500">
                  <bdi>{row.patient.code}</bdi>
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {[purpose(row), row.dentistName].filter(Boolean).join(" · ") || "—"}
                {row.patient.phone && (
                  <span className="ms-2 whitespace-nowrap">
                    <bdi>{formatLocalPhone(row.patient.phone)}</bdi>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {row.state === "sent" && (
              <Badge className="bg-green-100 text-green-700" data-testid="reminder-sent">
                <CheckCircle2Icon aria-hidden />
                {t("sentAt", {
                  time: format.dateTime(row.lastSentAt!, { timeStyle: "short" }),
                  name: row.lastSentBy ?? t("unknownUser"),
                })}
                {row.sentCount > 1 && ` (${t("times", { count: row.sentCount })})`}
              </Badge>
            )}
            {row.state === "noPhone" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" disabled>
                      <PhoneOffIcon />
                      {t("noPhone")}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t("noPhoneHint")}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant={row.state === "sent" ? "outline" : "default"}
                className={
                  row.state === "sent" ? "text-green-700" : "bg-green-600 hover:bg-green-700"
                }
                disabled={pending}
                onClick={() => send(row)}
              >
                <MessageCircleIcon />
                {row.state === "sent" ? t("sendAgain") : t("send")}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

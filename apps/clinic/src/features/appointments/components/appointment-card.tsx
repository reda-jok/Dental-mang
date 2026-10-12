"use client"

import {
  BanIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  ClockIcon,
  FolderOpenIcon,
  MapPinIcon,
  MessageCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  UserIcon,
  UserXIcon,
} from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parseIsoDate, zonedInstant } from "@/lib/dates"
import { useActionErrorHandler } from "@/lib/form"
import { cn } from "@/lib/utils"
import { reminderMessage } from "@/lib/whatsapp"

import { useLogReminder } from "../../reminders/components/use-log-reminder"
import { setAppointmentStatusAction } from "../actions"
import type { AppointmentView } from "../data"
import { formatTime, STATUS_BADGE, visitPurpose } from "../display"
import { hhmmToMinutes } from "../rules"
import { useBooking } from "./booking-provider"
import { FinishVisitDialog } from "./finish-visit-dialog"

/**
 * One appointment with its next actions. On the calendar reception reminds, marks a no-show
 * or cancels; starting and finishing the visit happen on the patient page (`where="patient"`),
 * where the dentist records the work.
 */
export function AppointmentCard({
  appointment: a,
  canWrite,
  canFinish = false,
  where = "calendar",
}: {
  appointment: AppointmentView
  canWrite: boolean
  /** May record the work (clinical:write). */
  canFinish?: boolean
  where?: "calendar" | "patient"
}) {
  const t = useTranslations("appointments")
  const tc = useTranslations("common")
  const format = useFormatter()
  const handleError = useActionErrorHandler()
  const { openBooking, openWhatsApp, config } = useBooking()
  const { log: logReminder } = useLogReminder()
  const [pending, startTransition] = useTransition()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const onPatientPage = where === "patient"
  const purpose = visitPurpose(a, (r) => t(`reasons.${r}`))

  const setStatus = (status: "in_progress" | "cancelled" | "no_show") =>
    startTransition(async () => {
      const result = await setAppointmentStatusAction({ id: a.id, status })
      if (!result.ok) return handleError(result)
      toast.success(t("statusChanged"))
      setConfirmCancel(false)
    })

  const remind = () =>
    a.patient.phone &&
    openWhatsApp({
      kind: "reminder",
      phone: a.patient.phone,
      patientName: a.patient.fullName,
      message: reminderMessage({
        clinicName: config.clinicName,
        patientName: a.patient.fullName,
        startsAt: zonedInstant(a.date, hhmmToMinutes(a.time)!, config.timeZone),
        dentistName: a.dentist?.name,
        procedureName: purpose,
        timeZone: config.timeZone,
      }),
      // Logged so the daily reminder list shows the patient as reminded.
      onSent: canWrite && a.status === "pending" ? () => logReminder(a.id) : undefined,
    })

  const bookAgain = () =>
    openBooking?.({
      patient: { id: a.patient.id, fullName: a.patient.fullName, phone: a.patient.phone },
    })

  const textButton = (
    label: string,
    tip: string,
    icon: React.ReactNode,
    onClick: () => void,
    className?: string,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onClick}
          className={className}
        >
          {icon}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )

  return (
    <article
      data-appointment={a.id}
      data-status={a.status}
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md",
        a.status === "completed" && "border-emerald-300 bg-emerald-50",
        (a.status === "cancelled" || a.status === "no_show") && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* At least 16rem wide: on a phone the buttons wrap below instead of squeezing it. */}
        <div className="min-w-0 flex-1 basis-64 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              <ClockIcon className="size-4 text-slate-400" aria-hidden />
              <span className="font-medium">{formatTime(a.time)}</span>
              <span className="text-sm text-slate-500">
                ({t("minutes", { count: String(a.durationMinutes) })})
              </span>
            </span>
            <Badge className={STATUS_BADGE[a.status]}>{t(`statuses.${a.status}`)}</Badge>
            {a.priority === "urgent" && (
              <Badge variant="destructive">{t("priorities.urgent")}</Badge>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <UserIcon className="size-4 text-slate-400" aria-hidden />
                <Link
                  href={`/patients/${a.patient.id}` as Route}
                  className="font-medium hover:underline"
                >
                  {a.patient.fullName}
                </Link>
              </div>
              <p className="ms-6 text-sm text-slate-500">{purpose ?? "—"}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm">
                <MapPinIcon className="size-4 text-slate-400" aria-hidden />
                {a.dentist?.name ?? t("noDentist")} · {a.room?.name ?? t("noRoom")}
              </div>
              {a.notes && <p className="ms-6 text-sm text-slate-500">{a.notes}</p>}
            </div>
          </div>
          {/* After the visit: is the next one booked? */}
          {a.next !== undefined && (
            <p
              className={cn(
                "flex items-center gap-2 text-sm",
                a.next ? "text-slate-600" : "text-amber-700",
              )}
              data-testid="next-appointment"
            >
              <CalendarClockIcon className="size-4" aria-hidden />
              {a.next
                ? t("nextOn", {
                    date: format.dateTime(parseIsoDate(a.next.date)!, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    }),
                    time: formatTime(a.next.time),
                  })
                : t("noNext")}
            </p>
          )}
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {onPatientPage &&
              a.status === "pending" &&
              textButton(t("start"), t("startTip"), <PlayIcon />, () => setStatus("in_progress"))}
            {onPatientPage && a.status === "in_progress" && (
              <IconButton
                label={t("completeTip")}
                disabledReason={canFinish ? null : t("finishNoPermission")}
                variant="outline"
                size="sm"
                onClick={() => setFinishing(true)}
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                <CheckCircle2Icon />
                {t("complete")}
              </IconButton>
            )}
            {!onPatientPage && (a.status === "pending" || a.status === "in_progress") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/patients/${a.patient.id}/appointments` as Route}>
                  <FolderOpenIcon />
                  {t("openPatient")}
                </Link>
              </Button>
            )}
            {onPatientPage &&
              a.status === "completed" &&
              openBooking &&
              textButton(t("bookNext"), t("bookNextTip"), <CalendarPlusIcon />, bookAgain)}
            {onPatientPage &&
              (a.status === "no_show" || a.status === "cancelled") &&
              openBooking &&
              textButton(t("reschedule"), t("rescheduleTip"), <RotateCcwIcon />, bookAgain)}
            {(a.status === "pending" || a.status === "in_progress") && a.patient.phone && (
              <IconButton
                label={t("remindTip")}
                variant="outline"
                onClick={remind}
                className="text-green-700"
              >
                <MessageCircleIcon />
              </IconButton>
            )}
            {a.status === "pending" && (
              <>
                <IconButton
                  label={t("noShowTip")}
                  variant="outline"
                  pending={pending}
                  onClick={() => setStatus("no_show")}
                >
                  <UserXIcon />
                </IconButton>
                <IconButton
                  label={t("cancelTip")}
                  variant="outline"
                  pending={pending}
                  onClick={() => setConfirmCancel(true)}
                  className="text-destructive"
                >
                  <BanIcon />
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle", { name: a.patient.fullName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("cancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("close")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                setStatus("cancelled")
              }}
            >
              {t("cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {canFinish && <FinishVisitDialog visit={a} open={finishing} onOpenChange={setFinishing} />}
    </article>
  )
}

"use client"

import {
  BanIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  ClockIcon,
  MapPinIcon,
  MessageCircleIcon,
  PlayIcon,
  RotateCcwIcon,
  UserIcon,
  UserXIcon,
} from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
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
import { zonedInstant } from "@/lib/dates"
import { useActionErrorHandler } from "@/lib/form"
import { cn } from "@/lib/utils"
import { completedMessage, reminderMessage } from "@/lib/whatsapp"

import { setAppointmentStatusAction } from "../actions"
import type { AppointmentView } from "../data"
import { formatTime, STATUS_BADGE } from "../display"
import { hhmmToMinutes, type AppointmentStatus } from "../rules"
import { useBooking } from "./booking-provider"

/** One appointment, in the clinic's original scheduler card style, with its next actions. */
export function AppointmentCard({
  appointment: a,
  canWrite,
}: {
  appointment: AppointmentView
  canWrite: boolean
}) {
  const t = useTranslations("appointments")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const { openBooking, openWhatsApp, config } = useBooking()
  const [pending, startTransition] = useTransition()
  const [confirmCancel, setConfirmCancel] = useState(false)

  const setStatus = (status: AppointmentStatus) =>
    startTransition(async () => {
      const result = await setAppointmentStatusAction({ id: a.id, status })
      if (!result.ok) return handleError(result)
      toast.success(t("statusChanged"))
      setConfirmCancel(false)
      if (status === "completed" && a.patient.phone) {
        // Offer the "treatment completed" message right away.
        openWhatsApp({
          kind: "completed",
          phone: a.patient.phone,
          patientName: a.patient.fullName,
          message: completedMessage({
            clinicName: config.clinicName,
            patientName: a.patient.fullName,
            startsAt: a.startsAt,
            dentistName: a.dentist?.name,
            procedureName: a.procedure?.name,
            timeZone: config.timeZone,
          }),
        })
      }
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
        procedureName: a.procedure?.name,
        timeZone: config.timeZone,
      }),
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
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md",
        (a.status === "cancelled" || a.status === "no_show") && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
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
              <p className="ms-6 text-sm text-slate-500">{a.procedure?.name ?? "—"}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm">
                <MapPinIcon className="size-4 text-slate-400" aria-hidden />
                {a.dentist?.name ?? t("noDentist")} · {a.room?.name ?? t("noRoom")}
              </div>
              {a.notes && <p className="ms-6 text-sm text-slate-500">{a.notes}</p>}
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {a.status === "pending" &&
              textButton(t("start"), t("startTip"), <PlayIcon />, () => setStatus("in_progress"))}
            {a.status === "in_progress" &&
              textButton(
                t("complete"),
                t("completeTip"),
                <CheckCircle2Icon />,
                () => setStatus("completed"),
                "border-green-500 text-green-700 hover:bg-green-50",
              )}
            {a.status === "completed" &&
              openBooking &&
              textButton(t("bookNext"), t("bookNextTip"), <CalendarPlusIcon />, bookAgain)}
            {(a.status === "no_show" || a.status === "cancelled") &&
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
    </article>
  )
}

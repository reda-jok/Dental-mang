"use client"

import { CalendarPlusIcon, CoffeeIcon, ExternalLinkIcon } from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parseIsoDate } from "@/lib/dates"
import { useActionErrorHandler } from "@/lib/form"
import { cn } from "@/lib/utils"

import { setRestDayAction } from "../actions"
import type { AppointmentView } from "../data"
import { formatTime, STATUS_CHIP } from "../display"
import { useBooking } from "./booking-provider"

type Props = {
  date: string | null
  onClose: () => void
  today: string
  appointments: AppointmentView[]
  holiday: { date: string; reason: string | null } | null
  weeklyOff: boolean
  canManageRestDays: boolean
}

/** The clinic's original day popup: that day's appointments and the rest-day switch. */
export function DayViewDialog({
  date,
  onClose,
  today,
  appointments,
  holiday,
  weeklyOff,
  canManageRestDays,
}: Props) {
  const t = useTranslations("appointments")
  const format = useFormatter()
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const { openBooking } = useBooking()
  const [pending, startTransition] = useTransition()

  const closed = !!holiday || weeklyOff

  const toggleRestDay = (value: boolean) =>
    date &&
    startTransition(async () => {
      const result = await setRestDayAction({ date, closed: value, reason: "" })
      if (!result.ok) return handleError(result)
      if (value) {
        toast.success(t("restDayClosed"), {
          description:
            result.data.affected > 0
              ? t("restDayAffected", { count: result.data.affected })
              : undefined,
        })
      } else {
        toast.success(t("restDayOpened"))
      }
      router.refresh()
    })

  const switchControl = (
    <Switch
      id="restDay"
      checked={closed}
      disabled={!canManageRestDays || weeklyOff || pending}
      onCheckedChange={toggleRestDay}
    />
  )

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("sm:max-w-md", closed && "border-red-200 bg-red-50")}>
        <DialogHeader>
          <DialogTitle>
            {date && format.dateTime(parseIsoDate(date)!, { dateStyle: "full", timeZone: "UTC" })}
          </DialogTitle>
          <DialogDescription>{t("dayDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="restDay" className="text-sm font-medium">
              {weeklyOff ? t("weeklyOff") : t("restDayToggle")}
            </Label>
            {canManageRestDays ? (
              switchControl
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{switchControl}</span>
                </TooltipTrigger>
                <TooltipContent>{t("restDayNoPermission")}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {closed && (
            <div className="flex flex-col items-center justify-center py-6 text-red-600">
              <CoffeeIcon className="mb-2 size-12" aria-hidden />
              <span className="font-medium">{t("restDay")}</span>
              {holiday?.reason && <span className="text-sm">{holiday.reason}</span>}
            </div>
          )}

          {!closed && appointments.length === 0 && (
            <p className="text-sm text-slate-500">{t("noAppointments")}</p>
          )}

          {appointments.length > 0 && (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {appointments.map((a) => (
                <li key={a.id} className={cn("rounded p-2", STATUS_CHIP[a.status])}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatTime(a.time)}</span>
                    <Badge className={cn("text-xs", STATUS_CHIP[a.status])}>
                      {t(`statuses.${a.status}`)}
                    </Badge>
                  </div>
                  <div className="truncate text-sm">{a.patient.fullName}</div>
                  {a.procedure && (
                    <div className="truncate text-sm opacity-80">{a.procedure.name}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {date && (
            <Button asChild variant="outline">
              <Link href={`/appointments?date=${date}` as Route} onClick={onClose}>
                <ExternalLinkIcon />
                {t("openDay")}
              </Link>
            </Button>
          )}
          {openBooking && date && !closed && date >= today && (
            <Button
              onClick={() => {
                onClose()
                openBooking({ date })
              }}
            >
              <CalendarPlusIcon />
              {t("newAppointment")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

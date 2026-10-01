"use client"

import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CoffeeIcon,
} from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"

import { IconButton } from "@/components/icon-button"
import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { addDays, parseIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

import type { AppointmentView } from "../data"
import { formatTime, STATUS_BADGE } from "../display"
import { isRestDay, weekOf } from "../rules"
import { AppointmentCard } from "./appointment-card"
import { useBooking } from "./booking-provider"

type Props = {
  date: string
  view: "day" | "week"
  today: string
  appointments: AppointmentView[]
  holidays: { date: string; reason: string | null }[]
  weeklyOffDays: number[]
  canWrite: boolean
}

/** The clinic's original appointment scheduler: booked times + appointment cards. */
export function Scheduler({
  date,
  view,
  today,
  appointments,
  holidays,
  weeklyOffDays,
  canWrite,
}: Props) {
  const t = useTranslations("appointments")
  const format = useFormatter()
  const router = useRouter()
  const pathname = usePathname()
  const { openBooking } = useBooking()
  const holidaySet = new Set(holidays.map((h) => h.date))

  const go = (next: { date?: string; view?: "day" | "week" }) =>
    router.replace(`${pathname}?date=${next.date ?? date}&view=${next.view ?? view}` as Route, {
      scroll: false,
    })

  const days = view === "day" ? [date] : weekOf(date)
  const label =
    view === "day"
      ? format.dateTime(parseIsoDate(date)!, { dateStyle: "full", timeZone: "UTC" })
      : `${format.dateTime(parseIsoDate(days[0]!)!, { day: "numeric", month: "short", timeZone: "UTC" })} – ${format.dateTime(parseIsoDate(days[6]!)!, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`

  const dayAppointments = appointments.filter((a) => a.date === date)
  const restToday = view === "day" && isRestDay(date, holidaySet, weeklyOffDays)
  const times = [...new Set(dayAppointments.map((a) => a.time))]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <IconButton
              label={t("previous")}
              variant="outline"
              onClick={() => go({ date: addDays(date, view === "day" ? -1 : -7) })}
            >
              <ChevronRightIcon className="ltr:rotate-180" />
            </IconButton>
            <span className="min-w-56 text-center text-sm font-medium" aria-live="polite">
              {label}
            </span>
            <IconButton
              label={t("next")}
              variant="outline"
              onClick={() => go({ date: addDays(date, view === "day" ? 1 : 7) })}
            >
              <ChevronLeftIcon className="ltr:rotate-180" />
            </IconButton>
            <Button variant="outline" size="sm" onClick={() => go({ date: today })}>
              {t("today")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {(["day", "week"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "outline"}
                aria-pressed={view === v}
                onClick={() => go({ view: v })}
              >
                {t(v)}
              </Button>
            ))}
            {openBooking && !restToday && date >= today && (
              <Button
                size="sm"
                onClick={() => openBooking({ date: view === "day" ? date : undefined })}
              >
                <CalendarPlusIcon />
                {t("newAppointment")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {view === "week" ? (
        <div className="space-y-4">
          {days.map((d) => {
            const list = appointments.filter((a) => a.date === d)
            const rest = isRestDay(d, holidaySet, weeklyOffDays)
            return (
              <Panel
                key={d}
                as="h3"
                title={format.dateTime(parseIsoDate(d)!, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
                className={cn(rest && "border-red-200", d === today && "ring-2 ring-blue-200")}
                actions={
                  <Button variant="ghost" size="sm" onClick={() => go({ date: d, view: "day" })}>
                    {t("openDay")}
                  </Button>
                }
              >
                {rest ? (
                  <p className="flex items-center gap-2 text-sm text-red-600">
                    <CoffeeIcon className="size-4" /> {t("restDay")}
                  </p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("noAppointments")}</p>
                ) : (
                  <div className="space-y-3">
                    {list.map((a) => (
                      <AppointmentCard key={a.id} appointment={a} canWrite={canWrite} />
                    ))}
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      ) : restToday ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-red-600">
            <CoffeeIcon className="mb-2 size-12" aria-hidden />
            <span className="font-medium">{t("restDay")}</span>
            <span className="text-sm">{t("restDayHint")}</span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Panel
            as="h3"
            icon={ClockIcon}
            title={t("bookedTimes")}
            className="lg:col-span-1"
            contentClassName="p-3"
          >
            {times.length === 0 ? (
              <p className="text-sm text-slate-400">{t("noAppointments")}</p>
            ) : (
              <ul className="space-y-2">
                {times.map((time) => (
                  <li key={time} className="rounded-lg border p-2 text-sm">
                    <div className="font-medium">{formatTime(time)}</div>
                    {dayAppointments
                      .filter((a) => a.time === time)
                      .map((a) => (
                        <Badge
                          key={a.id}
                          className={cn("mt-1 block truncate text-xs", STATUS_BADGE[a.status])}
                        >
                          {a.patient.fullName}
                          {a.procedure && ` — ${a.procedure.name}`}
                        </Badge>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            as="h3"
            title={t("dayAppointments", { count: String(dayAppointments.length) })}
            className="lg:col-span-3"
          >
            {dayAppointments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t("noAppointments")}</p>
            ) : (
              <div className="space-y-4">
                {dayAppointments.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} canWrite={canWrite} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

"use client"

import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CoffeeIcon,
  RefreshCwIcon,
} from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

import { IconButton } from "@/components/icon-button"
import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { addDays, parseIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

import type { AppointmentView } from "../data"
import { formatTime, STATUS_CHIP } from "../display"
import { isRestDay, monthGrid, weekOf } from "../rules"
import { DayViewDialog } from "./day-view-dialog"

export type CalendarView = "month" | "week"

type Props = {
  anchor: string // any date in the shown month/week
  view: CalendarView
  today: string
  appointments: AppointmentView[]
  holidays: { date: string; reason: string | null }[]
  weeklyOffDays: number[]
  canManageRestDays: boolean
}

/** Month/week appointment calendar in the clinic's original style. */
export function CalendarSection({
  anchor,
  view,
  today,
  appointments,
  holidays,
  weeklyOffDays,
  canManageRestDays,
}: Props) {
  const t = useTranslations("appointments")
  const format = useFormatter()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [refreshing, startRefresh] = useTransition()
  const [selected, setSelected] = useState<string | null>(null)

  const days = view === "month" ? monthGrid(anchor) : weekOf(anchor)
  const holidaySet = new Set(holidays.map((h) => h.date))
  const byDay = new Map<string, AppointmentView[]>()
  for (const a of appointments) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a])
  const perCell = view === "month" ? 2 : 4

  const navigate = (next: { anchor?: string; view?: CalendarView }) => {
    const search = new URLSearchParams(params)
    search.set("cal", next.anchor ?? anchor)
    search.set("view", next.view ?? view)
    router.replace(`${pathname}?${search}` as Route, { scroll: false })
  }

  const step = (direction: 1 | -1) => {
    if (view === "week") return navigate({ anchor: addDays(anchor, 7 * direction) })
    const d = parseIsoDate(`${anchor.slice(0, 7)}-01`)!
    d.setUTCMonth(d.getUTCMonth() + direction)
    navigate({ anchor: d.toISOString().slice(0, 10) })
  }

  const label =
    view === "month"
      ? format.dateTime(parseIsoDate(anchor)!, { month: "long", year: "numeric", timeZone: "UTC" })
      : `${format.dateTime(parseIsoDate(days[0]!)!, { day: "numeric", month: "short", timeZone: "UTC" })} – ${format.dateTime(parseIsoDate(days[6]!)!, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`

  const anchorMonth = anchor.slice(0, 7)

  return (
    <Panel
      icon={CalendarDaysIcon}
      title={t("calendarTitle")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label={t("previous")} variant="outline" onClick={() => step(-1)}>
            {/* RTL: "previous" points right */}
            <ChevronRightIcon className="ltr:rotate-180" />
          </IconButton>
          <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
            {label}
          </span>
          <IconButton label={t("next")} variant="outline" onClick={() => step(1)}>
            <ChevronLeftIcon className="ltr:rotate-180" />
          </IconButton>
          <Button variant="outline" size="sm" onClick={() => navigate({ anchor: today })}>
            {t("today")}
          </Button>
          <div className="flex gap-1">
            {(["week", "month"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "outline"}
                aria-pressed={view === v}
                onClick={() => navigate({ view: v })}
              >
                {t(v)}
              </Button>
            ))}
          </div>
          <IconButton
            label={t("refresh")}
            variant="outline"
            pending={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
          >
            <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
          </IconButton>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[640px] space-y-2">
          <div className="grid grid-cols-7 gap-2">
            {days.slice(0, 7).map((d) => (
              <div key={d} className="p-2 text-center text-sm font-medium text-slate-500">
                {format.dateTime(parseIsoDate(d)!, { weekday: "long", timeZone: "UTC" })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const dayAppointments = byDay.get(d) ?? []
              const rest = isRestDay(d, holidaySet, weeklyOffDays)
              const inMonth = view === "week" || d.slice(0, 7) === anchorMonth
              const isToday = d === today
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  onClick={() => setSelected(d)}
                  aria-label={format.dateTime(parseIsoDate(d)!, {
                    dateStyle: "full",
                    timeZone: "UTC",
                  })}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-2 text-start transition-colors hover:bg-slate-50",
                    view === "month" ? "min-h-[100px]" : "min-h-[160px]",
                    isToday ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white",
                    rest && "border-red-200 bg-red-50 hover:bg-red-100/60",
                    !inMonth && "opacity-40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isToday ? "text-blue-700" : rest ? "text-red-700" : "text-slate-900",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {rest ? (
                      <CoffeeIcon className="size-3 text-red-600" aria-hidden />
                    ) : (
                      dayAppointments.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {dayAppointments.length}
                        </Badge>
                      )
                    )}
                  </div>

                  {rest ? (
                    <div className="flex flex-1 flex-col items-center justify-center text-red-600">
                      <CoffeeIcon className="mb-1 size-5" aria-hidden />
                      <span className="text-xs font-medium">{t("restDay")}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {dayAppointments.slice(0, perCell).map((a) => (
                        <div
                          key={a.id}
                          className={cn("truncate rounded p-1 text-xs", STATUS_CHIP[a.status])}
                        >
                          <div className="font-medium">{formatTime(a.time)}</div>
                          <div className="truncate">{a.patient.fullName}</div>
                        </div>
                      ))}
                      {dayAppointments.length > perCell && (
                        <div className="text-center text-xs text-slate-500">
                          {t("more", { count: String(dayAppointments.length - perCell) })}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <DayViewDialog
        date={selected}
        onClose={() => setSelected(null)}
        today={today}
        appointments={selected ? (byDay.get(selected) ?? []) : []}
        holiday={holidays.find((h) => h.date === selected) ?? null}
        weeklyOff={selected ? isRestDay(selected, new Set(), weeklyOffDays) : false}
        canManageRestDays={canManageRestDays}
      />
    </Panel>
  )
}

import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ListChecksIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import { CalendarSection } from "@/features/appointments/components/calendar-section"
import { getScheduleConfig, listAppointments, listHolidays } from "@/features/appointments/data"
import { formatTime, STATUS_BADGE } from "@/features/appointments/display"
import { calendarParams } from "@/features/appointments/params"
import { monthGrid, weekOf } from "@/features/appointments/rules"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { getDashboard } from "@/features/dashboard/data"
import { todayIso } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { requireUser } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("dashboard") }
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser()
  const canAppointments = hasPermission(user.role, "appointment:read")
  const config = await getScheduleConfig()
  const today = todayIso(config.timeZone)
  const { cal = today, view } = calendarParams.parse(await searchParams)
  const range = view === "month" ? monthGrid(cal) : weekOf(cal)

  const [data, todays, calendarAppointments, holidays, t, ta, format] = await Promise.all([
    getDashboard(user),
    canAppointments ? listAppointments(today, today) : null,
    canAppointments ? listAppointments(range[0]!, range.at(-1)!) : null,
    canAppointments ? listHolidays(range[0]!, range.at(-1)!) : null,
    getTranslations("dashboard"),
    getTranslations("appointments"),
    getFormatter(),
  ])

  const count = (status: string) => todays?.filter((a) => a.status === status).length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {t("welcome", { name: user.name })}
        </h2>
        <p className="text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.totalPatients !== null && (
          <StatCard
            title={t("totalPatients")}
            value={format.number(data.totalPatients)}
            icon={UsersIcon}
            iconClassName="bg-blue-50 text-blue-600"
          />
        )}
        {todays && (
          <StatCard
            title={t("todayCount")}
            value={format.number(todays.filter((a) => a.status !== "cancelled").length)}
            icon={CalendarDaysIcon}
            iconClassName="bg-green-50 text-green-600"
            note={t("todayNote", {
              pending: String(count("pending")),
              done: String(count("completed")),
            })}
          />
        )}
        {data.newPatients !== null && (
          <StatCard
            title={t("newPatients")}
            value={format.number(data.newPatients)}
            icon={UserPlusIcon}
            iconClassName="bg-purple-50 text-purple-600"
            note={t("thisMonth")}
          />
        )}
        {data.doneThisMonth && (
          <StatCard
            title={t("doneThisMonth")}
            value={
              data.doneThisMonth.totals.length === 0 ? (
                format.number(0)
              ) : (
                <span className="flex flex-col gap-0.5 text-xl" dir="ltr">
                  {data.doneThisMonth.totals.map((x) => (
                    <span key={x.currency} className="text-end">
                      {formatMoney(x.amount, x.currency)}
                    </span>
                  ))}
                </span>
              )
            }
            icon={CheckCircle2Icon}
            iconClassName="bg-orange-50 text-orange-600"
            note={t("doneThisMonthNote", { count: data.doneThisMonth.count })}
          />
        )}
      </div>

      {/* Calendar */}
      {calendarAppointments && holidays && (
        <CalendarSection
          anchor={cal}
          view={view}
          today={today}
          appointments={calendarAppointments}
          holidays={holidays}
          weeklyOffDays={config.weeklyOffDays}
          canManageRestDays={hasPermission(user.role, "settings:write")}
        />
      )}

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {todays && (
          <Panel
            icon={CalendarDaysIcon}
            title={t("todayAppointments")}
            description={format.dateTime(new Date(), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          >
            {todays.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t("noAppointmentsToday")}</p>
            ) : (
              <ul className="space-y-3">
                {todays.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments?date=${today}` as Route}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.patient.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {a.procedure?.name ?? "—"} · {formatTime(a.time)}
                        </p>
                      </div>
                      <Badge className={cn("shrink-0", STATUS_BADGE[a.status])}>
                        {ta(`statuses.${a.status}`)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel
          icon={ListChecksIcon}
          title={t("quickStats")}
          description={t("quickStatsDescription")}
        >
          <ul className="space-y-3">
            {[
              ...(todays
                ? [
                    { label: t("pendingToday"), value: count("pending") },
                    { label: t("inProgress"), value: count("in_progress") },
                    { label: t("completedToday"), value: count("completed") },
                    { label: t("noShowsToday"), value: count("no_show") },
                  ]
                : []),
              ...(data.openPlans !== null
                ? [{ label: t("openPlans"), value: data.openPlans }]
                : []),
              ...(data.newPatients !== null
                ? [{ label: t("newPatients"), value: data.newPatients }]
                : []),
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <span className="font-bold">{format.number(item.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

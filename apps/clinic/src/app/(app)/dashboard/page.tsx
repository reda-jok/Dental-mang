import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"
import type { ReactNode } from "react"

import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import { CalendarSection } from "@/features/appointments/components/calendar-section"
import { getScheduleConfig, listAppointments, listHolidays } from "@/features/appointments/data"
import { formatTime, STATUS_BADGE } from "@/features/appointments/display"
import { calendarParams } from "@/features/appointments/params"
import { monthGrid, weekOf } from "@/features/appointments/rules"
import { CustomizeDashboard } from "@/features/dashboard/components/customize-dashboard"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { getDashboard, getDashboardLayout } from "@/features/dashboard/data"
import { WIDGETS, type WidgetKey } from "@/features/dashboard/widgets"
import { LabAlerts } from "@/features/lab/components/lab-alerts"
import { getLabSummary } from "@/features/lab/data"
import { todayIso } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { hasPermission, ROLE_NAMES } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { requireUser } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("dashboard") }
}

const WIDE = new Set<WidgetKey>(WIDGETS.filter((w) => w.size === "wide").map((w) => w.key))

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser()
  const layout = await getDashboardLayout(user)
  const visible = layout.items.filter((i) => !i.hidden)
  const show = new Set(visible.map((i) => i.key))

  const config = await getScheduleConfig()
  const today = todayIso(config.timeZone)
  const { cal = today, view } = calendarParams.parse(await searchParams)
  const range = view === "month" ? monthGrid(cal) : weekOf(cal)

  // Only what the visible widgets need (the layout holds only widgets the role may see).
  const [data, todays, calendarAppointments, holidays, lab, t, ta, format] = await Promise.all([
    getDashboard(user),
    show.has("todayCount") || show.has("todayAppointments") ? listAppointments(today, today) : null,
    show.has("calendar") ? listAppointments(range[0]!, range.at(-1)!) : null,
    show.has("calendar") ? listHolidays(range[0]!, range.at(-1)!) : null,
    show.has("labAlerts") ? getLabSummary() : null,
    getTranslations("dashboard"),
    getTranslations("appointments"),
    getFormatter(),
  ])

  const count = (status: string) => todays?.filter((a) => a.status === status).length ?? 0

  const widgets: Record<WidgetKey, ReactNode> = {
    totalPatients: data.totalPatients !== null && (
      <StatCard
        title={t("totalPatients")}
        value={format.number(data.totalPatients)}
        icon={UsersIcon}
        iconClassName="bg-blue-50 text-blue-600"
      />
    ),
    todayCount: todays && (
      <StatCard
        title={t("todayCount")}
        value={format.number(todays.filter((a) => a.status !== "cancelled").length)}
        icon={CalendarDaysIcon}
        iconClassName="bg-green-50 text-green-600"
        note={t("todayNote", {
          pending: String(count("pending")),
          inChair: String(count("in_progress")),
          done: String(count("completed")),
        })}
      />
    ),
    newPatients: data.newPatients !== null && (
      <StatCard
        title={t("newPatients")}
        value={format.number(data.newPatients)}
        icon={UserPlusIcon}
        iconClassName="bg-purple-50 text-purple-600"
        note={t("thisMonth")}
      />
    ),
    treatmentValue: data.doneThisMonth && (
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
        note={
          <>
            {t("doneThisMonthNote", { count: data.doneThisMonth.count })}
            <span className="block">{t("notCollected")}</span>
          </>
        }
      />
    ),
    openPlans: data.openPlans !== null && (
      <StatCard
        title={t("openPlans")}
        value={format.number(data.openPlans)}
        icon={ClipboardListIcon}
        iconClassName="bg-sky-50 text-sky-600"
        note={t("openPlansNote")}
      />
    ),
    labAlerts: lab && lab.urgent.length > 0 && <LabAlerts cases={lab.urgent} late={lab.late} />,
    todayAppointments: todays && (
      <Panel
        icon={CalendarDaysIcon}
        title={t("todayAppointments")}
        description={format.dateTime(new Date(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <Link
            href={`/appointments?date=${today}` as Route}
            className="text-primary text-sm font-medium hover:underline"
          >
            {t("seeAll")}
          </Link>
        }
      >
        {todays.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("noAppointmentsToday")}</p>
        ) : (
          <ul className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {todays.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/patients/${a.patient.id}` as Route}
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
    ),
    calendar: calendarAppointments && holidays && (
      <CalendarSection
        anchor={cal}
        view={view}
        today={today}
        appointments={calendarAppointments}
        holidays={holidays}
        weeklyOffDays={config.weeklyOffDays}
        canManageRestDays={hasPermission(user.role, "settings:write")}
      />
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {t("welcome", { name: user.name })}
          </h2>
          <p className="text-sm text-slate-500">{t("subtitle")}</p>
        </div>
        <CustomizeDashboard
          items={layout.items}
          custom={layout.custom}
          roles={
            hasPermission(user.role, "settings:permissions")
              ? ROLE_NAMES.filter((r) => r !== "owner")
              : null
          }
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">{t("allHidden")}</p>
      ) : (
        <>
          {/* Number cards together in one grid, then the panels, each in the user's order. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visible
              .filter(({ key }) => !WIDE.has(key) && widgets[key])
              .map(({ key }) => (
                <div key={key} data-widget={key} className="min-w-0">
                  {widgets[key]}
                </div>
              ))}
          </div>
          {visible
            .filter(({ key }) => WIDE.has(key) && widgets[key])
            .map(({ key }) => (
              <div key={key} data-widget={key} data-wide className="min-w-0">
                {widgets[key]}
              </div>
            ))}
        </>
      )}
    </div>
  )
}

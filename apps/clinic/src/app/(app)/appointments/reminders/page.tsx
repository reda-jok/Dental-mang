import { CheckCircle2Icon, MessageCircleIcon, PhoneOffIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { ReminderDayNav } from "@/features/reminders/components/reminder-day-nav"
import { ReminderList } from "@/features/reminders/components/reminder-list"
import { getReminderDay, getReminderDefaultDay } from "@/features/reminders/data"
import { REMINDER_FILTERS, reminderParams } from "@/features/reminders/schemas"
import { parseIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reminders")
  return { title: t("title") }
}

export default async function RemindersPage({
  searchParams,
}: PageProps<"/appointments/reminders">) {
  await requirePagePermission("appointment:write")
  const params = reminderParams.parse(await searchParams)
  const defaultDay = await getReminderDefaultDay()
  const date = params.date ?? defaultDay
  const [{ rows, summary }, t, format] = await Promise.all([
    getReminderDay(date),
    getTranslations("reminders"),
    getFormatter(),
  ])
  const shown = params.show === "todo" ? rows.filter((r) => r.state === "todo") : rows
  const dayLabel = format.dateTime(parseIsoDate(date)!, { dateStyle: "full", timeZone: "UTC" })

  return (
    <div className="space-y-6">
      {/* On a phone the filter links carry the counts; the list comes first. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-3">
        <StatCard
          title={t("todo")}
          value={format.number(summary.todo)}
          icon={MessageCircleIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("ofTotal", { total: String(summary.total) })}
        />
        <StatCard
          title={t("sent")}
          value={format.number(summary.sent)}
          icon={CheckCircle2Icon}
          iconClassName="bg-blue-50 text-blue-600"
        />
        <StatCard
          title={t("noPhoneCount")}
          value={format.number(summary.noPhone)}
          icon={PhoneOffIcon}
          iconClassName="bg-slate-100 text-slate-600"
          note={t("noPhoneNote")}
        />
      </div>

      <Panel
        icon={MessageCircleIcon}
        title={t("listTitle", { day: dayLabel })}
        description={t("description")}
        actions={<ReminderDayNav date={date} defaultDay={defaultDay} show={params.show} />}
      >
        <nav aria-label={t("filterLabel")} className="mb-3 flex gap-2">
          {REMINDER_FILTERS.map((show) => (
            <Link
              key={show}
              href={
                `/appointments/reminders?date=${date}${show === "all" ? "" : `&show=${show}`}` as Route
              }
              aria-current={params.show === show ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium",
                params.show === show
                  ? "bg-accent text-accent-foreground"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t(`filters.${show}`, {
                count: String(show === "all" ? summary.total : summary.todo),
              })}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("emptyDay")}</p>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("allSent")}</p>
        ) : (
          <ReminderList rows={shown} />
        )}
      </Panel>
    </div>
  )
}

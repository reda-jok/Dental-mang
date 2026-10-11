"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDays, parseIsoDate } from "@/lib/dates"

/** Which day's reminders: previous / next day, a date, and back to the usual day. */
export function ReminderDayNav({
  date,
  defaultDay,
  show,
}: {
  date: string
  defaultDay: string
  show: string
}) {
  const t = useTranslations("reminders")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const go = (day: string) =>
    startTransition(() =>
      router.replace(
        `/appointments/reminders?date=${day}${show === "all" ? "" : `&show=${show}`}` as Route,
        { scroll: false },
      ),
    )
  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
      <IconButton label={t("previousDay")} variant="outline" onClick={() => go(addDays(date, -1))}>
        <ChevronRightIcon />
      </IconButton>
      <Input
        type="date"
        dir="ltr"
        aria-label={t("day")}
        className="w-40"
        value={date}
        onChange={(e) => parseIsoDate(e.target.value) && go(e.target.value)}
      />
      <IconButton label={t("nextDay")} variant="outline" onClick={() => go(addDays(date, 1))}>
        <ChevronLeftIcon />
      </IconButton>
      {date !== defaultDay && (
        <Button variant="ghost" onClick={() => go(defaultDay)}>
          {t("backToDefault")}
        </Button>
      )}
    </div>
  )
}

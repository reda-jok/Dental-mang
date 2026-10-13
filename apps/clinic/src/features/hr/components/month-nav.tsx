import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { nextMonth, previousMonth } from "@/lib/dates"

/** Previous / next month links around the month's name (?month=YYYY-MM); `keep` carries other params along. */
export async function MonthNav({
  path,
  month,
  keep,
}: {
  path: string
  month: string
  keep?: Record<string, string>
}) {
  const t = await getTranslations("hr")
  const format = await getFormatter()
  const link = (m: string) => `${path}?${new URLSearchParams({ ...keep, month: m })}` as Route
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" asChild>
        <Link href={link(previousMonth(month))} aria-label={t("previousMonth")}>
          <ChevronRightIcon />
        </Link>
      </Button>
      <span className="min-w-28 text-center text-sm font-medium" data-testid="month">
        {format.dateTime(new Date(`${month}-01T00:00:00Z`), {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </span>
      <Button variant="outline" size="icon-sm" asChild>
        <Link href={link(nextMonth(month))} aria-label={t("nextMonth")}>
          <ChevronLeftIcon />
        </Link>
      </Button>
    </div>
  )
}

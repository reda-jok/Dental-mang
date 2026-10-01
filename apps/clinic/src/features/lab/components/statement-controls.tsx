"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { IconButton } from "@/components/icon-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Switch lab (same month) and step through months. Arrows follow the reading direction. */
export function StatementControls({
  labId,
  labs,
  month,
  monthLabel,
  prev,
  next,
}: {
  labId: string
  labs: { id: string; name: string }[]
  month: string
  monthLabel: string
  prev: string
  /** Null in the current month (nothing after it yet). */
  next: string | null
}) {
  const t = useTranslations("lab.statement")
  const router = useRouter()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={labId}
        onValueChange={(id) => router.push(`/lab/accounts/${id}?month=${month}`)}
      >
        <SelectTrigger className="w-56" aria-label={t("lab")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {labs.map((lab) => (
            <SelectItem key={lab.id} value={lab.id}>
              {lab.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1" role="group" aria-label={t("month")}>
        <IconButton label={t("prevMonth")} variant="outline" asChild>
          <Link href={`/lab/accounts/${labId}?month=${prev}`}>
            <ChevronRightIcon className="ltr:rotate-180" />
          </Link>
        </IconButton>
        <span className="min-w-28 text-center text-sm font-semibold" data-month={month}>
          {monthLabel}
        </span>
        {next ? (
          <IconButton label={t("nextMonth")} variant="outline" asChild>
            <Link href={`/lab/accounts/${labId}?month=${next}`}>
              <ChevronLeftIcon className="ltr:rotate-180" />
            </Link>
          </IconButton>
        ) : (
          <IconButton label={t("nextMonth")} variant="outline" disabledReason={t("noNextMonth")}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </div>
    </div>
  )
}

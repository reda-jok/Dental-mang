"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { addDays, parseIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

import { formatTime } from "../../appointments/display"
import { heatStep, type busyGrid } from "../stats"

/** One hue, light → dark (Tailwind blue steps get darker in order); empty = slate. */
const SHADES = [
  "bg-slate-100",
  "bg-blue-100",
  "bg-blue-200",
  "bg-blue-300",
  "bg-blue-500",
  "bg-blue-700",
] as const

/** A known Sunday, to name any weekday 0-6. */
const SUNDAY = "2026-10-11"

/** Weekday × hour heatmap of the last 90 days; every cell has its count in a tooltip. */
export function BusyHours({ grid }: { grid: ReturnType<typeof busyGrid> }) {
  const t = useTranslations("dashboard")
  const format = useFormatter()
  if (grid.max === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{t("busyHoursEmpty")}</p>
  }
  const dayName = (weekday: number) =>
    format.dateTime(parseIsoDate(addDays(SUNDAY, weekday))!, { weekday: "long", timeZone: "UTC" })
  const hourName = (hour: number) => formatTime(`${String(hour).padStart(2, "0")}:00`)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[28rem] border-separate border-spacing-0.5"
          data-testid="busy-hours"
        >
          <thead>
            <tr>
              <th className="w-20" />
              {grid.hours.map((hour) => (
                <th key={hour} scope="col" className="pb-1 text-xs font-normal text-slate-500">
                  {hourName(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.weekday}>
                <th scope="row" className="pe-2 text-start text-xs font-normal text-slate-600">
                  {dayName(row.weekday)}
                </th>
                {row.cells.map((count, i) => {
                  const label = t("busyCell", {
                    day: dayName(row.weekday),
                    hour: hourName(grid.hours[i]!),
                    count,
                  })
                  return (
                    <td key={grid.hours[i]} className="p-0">
                      <HeatCell
                        label={label}
                        count={count}
                        shade={SHADES[heatStep(count, grid.max)]}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-slate-500" aria-hidden>
        <span>{t("less")}</span>
        {SHADES.slice(1).map((shade) => (
          <span key={shade} className={cn("size-3 rounded-sm", shade)} />
        ))}
        <span>{t("more")}</span>
      </div>
    </div>
  )
}

/** A heat cell whose count shows on hover, keyboard focus and tap (tablets). */
function HeatCell({ label, count, shade }: { label: string; count: number; shade: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-count={count}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "block h-8 w-full rounded-sm focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none",
            shade,
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

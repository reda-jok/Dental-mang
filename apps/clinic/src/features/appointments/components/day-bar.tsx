"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

import { formatTime } from "../display"

/** The day as one thin bar of slots: free ones can be tapped to pick the time. */
export function DayBar({
  slots,
  selected,
  onPick,
}: {
  slots: { time: string; taken: boolean }[]
  selected: string
  onPick: (time: string) => void
}) {
  const t = useTranslations("appointments.form")
  if (slots.length === 0) return null
  return (
    <div className="space-y-1">
      <div role="group" aria-label={t("dayBar")} className="flex gap-0.5" data-testid="day-bar">
        {slots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            disabled={slot.taken}
            aria-pressed={selected === slot.time}
            aria-label={t("dayBarSlot", {
              time: formatTime(slot.time),
              state: slot.taken ? t("taken") : t("free"),
            })}
            data-state={slot.taken ? "taken" : "free"}
            onClick={() => onPick(slot.time)}
            className={cn(
              "h-5 min-w-0 flex-1 rounded-sm transition-colors",
              slot.taken ? "bg-slate-300" : "bg-green-500 hover:bg-green-600",
              selected === slot.time && "ring-primary ring-2 ring-offset-1",
            )}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{formatTime(slots[0]!.time)}</span>
        <span>{t("dayBarHint")}</span>
        <span>{formatTime(slots.at(-1)!.time)}</span>
      </div>
    </div>
  )
}

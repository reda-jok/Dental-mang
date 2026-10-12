"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

import { PERMANENT_ROWS, PRIMARY_ROWS, type Dentition } from "../../chart/teeth"
import type { ItemStatus } from "../rules"

/** The plan's teeth on a small chart: the phase number on each, a tick once done. */
export function PlanMiniChart({
  dentition,
  items,
}: {
  dentition: Dentition
  items: readonly { tooth: number | null; phase: number; status: ItemStatus }[]
}) {
  const t = useTranslations("plans")
  // A tooth with several treatments shows its earliest phase; done only when all are.
  const teeth = new Map<number, { phase: number; done: boolean; started: boolean }>()
  for (const item of items) {
    if (item.tooth === null || item.status === "cancelled") continue
    const was = teeth.get(item.tooth)
    teeth.set(item.tooth, {
      phase: Math.min(was?.phase ?? item.phase, item.phase),
      done: (was?.done ?? true) && item.status === "done",
      started: (was?.started ?? false) || item.status === "in_progress",
    })
  }

  const [upperPermanent, lowerPermanent] = PERMANENT_ROWS
  const [upperPrimary, lowerPrimary] = PRIMARY_ROWS
  const rows: (readonly number[])[] =
    dentition === "permanent"
      ? [upperPermanent, lowerPermanent]
      : dentition === "primary"
        ? [upperPrimary, lowerPrimary]
        : [upperPermanent, upperPrimary, lowerPrimary, lowerPermanent]

  return (
    <figure className="space-y-1" aria-label={t("chartLabel")} data-testid="plan-mini-chart">
      <div dir="ltr" className="space-y-1">
        {rows.map((row, r) => (
          <div
            key={row[0]}
            className={cn("flex justify-center gap-0.5", r === rows.length / 2 && "border-t pt-1")}
          >
            {row.map((tooth, i) => {
              const plan = teeth.get(tooth)
              return (
                <span
                  key={tooth}
                  data-tooth={tooth}
                  data-phase={plan?.phase}
                  className={cn(
                    "flex aspect-[3/4] max-w-7 min-w-0 flex-1 flex-col items-center justify-center rounded-md border text-[9px] leading-none",
                    i === row.length / 2 && "ms-1",
                    !plan && "text-muted-foreground border-slate-200",
                    plan &&
                      !plan.done &&
                      !plan.started &&
                      "bg-primary border-primary text-primary-foreground font-bold",
                    plan?.started &&
                      !plan.done &&
                      "border-amber-500 bg-amber-500 font-bold text-white",
                    plan?.done && "border-emerald-600 bg-emerald-600 font-bold text-white",
                  )}
                  title={plan ? t("phase", { phase: String(plan.phase) }) : undefined}
                >
                  <span className="opacity-70">{tooth}</span>
                  {plan && <span>{plan.done ? "✓" : plan.phase}</span>}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <figcaption className="text-muted-foreground flex flex-wrap justify-center gap-x-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="bg-primary size-2.5 rounded-sm" />
          {t("legendPlanned")}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-amber-500" />
          {t("itemStatuses.in_progress")}
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-emerald-600" />
          {t("itemStatuses.done")}
        </span>
      </figcaption>
    </figure>
  )
}

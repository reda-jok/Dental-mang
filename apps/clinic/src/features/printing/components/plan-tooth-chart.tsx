import { getTranslations } from "next-intl/server"

import { PERMANENT_ROWS, PRIMARY_ROWS, type Dentition } from "@/features/chart/teeth"
import { cn } from "@/lib/utils"

export type PlannedTooth = { phase: number; done: boolean }

/**
 * The patient's teeth for a printout: teeth in the plan are filled black with their phase
 * number under them (readable on a black-and-white printer), finished ones are grey with
 * a tick. Same layout as the screen chart: patient's right on the viewer's left.
 */
export async function PlanToothChart({
  dentition,
  planned,
  showPhases,
}: {
  dentition: Dentition
  planned: ReadonlyMap<number, PlannedTooth>
  showPhases: boolean
}) {
  const t = await getTranslations("print")
  const tc = await getTranslations("chart")
  const [upperPermanent, lowerPermanent] = PERMANENT_ROWS
  const [upperPrimary, lowerPrimary] = PRIMARY_ROWS
  const rows: (readonly number[])[] =
    dentition === "permanent"
      ? [upperPermanent, lowerPermanent]
      : dentition === "primary"
        ? [upperPrimary, lowerPrimary]
        : [upperPermanent, upperPrimary, lowerPrimary, lowerPermanent]

  return (
    <figure className="mt-3 break-inside-avoid" data-testid="plan-chart">
      <div dir="ltr" className="space-y-0.5">
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>{tc("patientRight")}</span>
          <span>{tc("patientLeft")}</span>
        </div>
        {rows.map((row, index) => (
          <div
            key={row[0]}
            className={cn(
              "flex justify-center gap-[1px]",
              index === rows.length / 2 && "mt-1 border-t border-slate-400 pt-1",
            )}
          >
            {row.map((tooth, i) => {
              const plan = planned.get(tooth)
              return (
                <div
                  key={tooth}
                  data-tooth={tooth}
                  data-phase={plan?.phase}
                  className={cn(
                    // 16 teeth across, so a primary row (10) is centred under them.
                    "flex w-[calc(6.25%_-_1.25px)] flex-col items-center rounded-[2px] border py-[1px] leading-none",
                    i === row.length / 2 && "ms-[3px]",
                    !plan && "border-slate-300 text-slate-400",
                    plan && !plan.done && "border-black bg-black font-bold text-white",
                    plan?.done && "border-slate-500 bg-slate-300 text-black",
                  )}
                >
                  <span className="text-[8px]">{tooth}</span>
                  <span className="h-[10px] text-[9px]">
                    {plan && (plan.done ? "✓" : showPhases ? plan.phase : "")}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <figcaption className="mt-1 text-[10px] text-slate-600">
        {showPhases ? t("chartLegend") : t("chartLegendSinglePhase")}
      </figcaption>
    </figure>
  )
}

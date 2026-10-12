"use client"

import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { KeyboardEvent } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { mainCondition, problemsOf, surfaceColor, toothConditions, type ToothState } from "../state"
import {
  isUpper,
  mesialOnRight,
  PERMANENT_ROWS,
  PRIMARY_ROWS,
  tint,
  type Conditions,
  type Dentition,
  type Surface,
} from "../teeth"

type Props = {
  dentition: Dentition
  chart: Map<number, ToothState>
  conditions: Conditions
  selectedTeeth: Set<number>
  onToggleTooth: (tooth: number) => void
  disabled?: boolean
}

/**
 * Interactive odontogram, FDI numbering. Always laid out left-to-right with the
 * patient's right on the viewer's left — never mirrored by the RTL page.
 */
export function ToothChart({
  dentition,
  chart,
  conditions,
  selectedTeeth,
  onToggleTooth,
  disabled,
}: Props) {
  const t = useTranslations("chart")

  const upperRows: (readonly number[])[] = []
  const lowerRows: (readonly number[])[] = []
  if (dentition !== "primary") upperRows.push(PERMANENT_ROWS[0])
  if (dentition !== "permanent") upperRows.push(PRIMARY_ROWS[0])
  if (dentition !== "permanent") lowerRows.push(PRIMARY_ROWS[1])
  if (dentition !== "primary") lowerRows.push(PERMANENT_ROWS[1])

  const row = (teeth: readonly number[]) => (
    <div className="flex justify-center gap-1.5">
      {teeth.map((tooth, i) => (
        <div key={tooth} className={cn("flex", i === teeth.length / 2 && "ms-3")}>
          <ToothTile
            tooth={tooth}
            state={chart.get(tooth)}
            conditions={conditions}
            selected={selectedTeeth.has(tooth)}
            onToggle={onToggleTooth}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div dir="ltr" className="w-full overflow-x-auto py-3">
      <div className="mx-auto flex w-max flex-col items-center gap-3 px-2">
        <div className="text-muted-foreground flex w-full justify-between text-xs">
          <span>{t("patientRight")}</span>
          <span>{t("patientLeft")}</span>
        </div>

        <p className="text-muted-foreground text-sm font-semibold tracking-widest">{t("upper")}</p>
        {upperRows.map((teeth) => (
          <div key={teeth[0]}>{row(teeth)}</div>
        ))}

        <div className="bg-border my-3 h-px w-3/4" role="separator" />

        {lowerRows.map((teeth) => (
          <div key={teeth[0]}>{row(teeth)}</div>
        ))}
        <p className="text-muted-foreground text-sm font-semibold tracking-widest">{t("lower")}</p>
      </div>
    </div>
  )
}

/** Where each surface sits on the drawing: buccal faces out of the arch, mesial the midline. */
function surfaceAt(tooth: number) {
  const upper = isUpper(tooth)
  const mesialRight = mesialOnRight(tooth)
  return {
    top: (upper ? "B" : "L") as Surface,
    bottom: (upper ? "L" : "B") as Surface,
    left: (mesialRight ? "D" : "M") as Surface,
    right: (mesialRight ? "M" : "D") as Surface,
  }
}

const REGIONS = {
  top: "M0 0 H30 L20 10 H10 Z",
  bottom: "M0 30 H30 L20 20 H10 Z",
  left: "M0 0 L10 10 V20 L0 30 Z",
  right: "M30 0 L20 10 V20 L30 30 Z",
  center: "M10 10 H20 V20 H10 Z",
} as const

/**
 * A tooth seen from the biting side, split into its five surfaces. With `onToggle` each
 * surface is a checkbox (the surface picker); otherwise it only shows colours.
 */
export function SurfaceDiagram({
  tooth,
  colorOf,
  selected,
  onToggle,
  labels,
  className,
}: {
  tooth: number
  colorOf: (surface: Surface) => string | null
  selected?: ReadonlySet<Surface>
  onToggle?: (surface: Surface) => void
  /** Surface names, shown as letters and read out (the picker). */
  labels?: (surface: Surface) => string
  className?: string
}) {
  const at = surfaceAt(tooth)
  const regions = [
    ["top", at.top],
    ["bottom", at.bottom],
    ["left", at.left],
    ["right", at.right],
    ["center", "O"],
  ] as const
  const letterAt = {
    top: [15, 6],
    bottom: [15, 26],
    left: [5, 16],
    right: [25, 16],
    center: [15, 16],
  }
  const keyToggle = (surface: Surface) => (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      onToggle?.(surface)
    }
  }
  return (
    <svg viewBox="-1 -1 32 32" className={className} aria-hidden={onToggle ? undefined : true}>
      {regions.map(([region, surface]) => {
        const color = colorOf(surface)
        const on = selected?.has(surface) ?? false
        return (
          <path
            key={region}
            d={REGIONS[region]}
            data-surface={surface}
            data-color={color ?? undefined}
            {...(onToggle && {
              "data-surface-chip": surface,
              role: "checkbox",
              "aria-checked": on,
              "aria-label": labels?.(surface),
              tabIndex: 0,
              onClick: () => onToggle(surface),
              onKeyDown: keyToggle(surface),
            })}
            style={{
              fill: on ? "var(--steel-100)" : (color ?? "#ffffff"),
              stroke: on ? "var(--steel-600)" : onToggle ? "#94a3b8" : "#cbd5e1",
            }}
            strokeWidth={on ? 1.2 : onToggle ? 0.6 : 0.5}
            strokeLinejoin="round"
            className={cn(
              onToggle && "cursor-pointer outline-none hover:opacity-80 focus-visible:opacity-70",
            )}
          />
        )
      })}
      {labels &&
        regions.map(([region, surface]) => (
          <text
            key={region}
            x={letterAt[region][0]}
            y={letterAt[region][1]}
            fontSize="4.5"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={colorOf(surface) && !selected?.has(surface) ? "#ffffff" : "#334155"}
            className="pointer-events-none select-none"
          >
            {surface}
          </text>
        ))}
    </svg>
  )
}

function ToothTile({
  tooth,
  state,
  conditions,
  selected,
  onToggle,
  disabled,
}: {
  tooth: number
  state: ToothState | undefined
  conditions: Conditions
  selected: boolean
  onToggle: (tooth: number) => void
  disabled?: boolean
}) {
  const t = useTranslations("chart")
  const upper = isUpper(tooth)
  const problems = problemsOf(state, conditions)
  const planned = state?.planned ?? []
  const inProgress = planned.some((p) => p.status === "in_progress")
  const lead = state?.gone ?? toothConditions(state, conditions)[0]
  const leadColor = lead ? conditions.get(lead)?.color : undefined
  const problemColor = problems[0] ? conditions.get(problems[0].condition)?.color : undefined
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)

  const lines = [
    ...(state?.marks ?? []).map(
      (m) =>
        `${conditions.get(m.condition)?.name ?? m.condition}${m.surfaces.length ? ` (${m.surfaces.map(surfaceName).join("، ")})` : ""}`,
    ),
    ...planned.map((p) => `${t("plannedOnTooth")}: ${p.procedureName}`),
  ]
  const label = `${t("toothLabel", { tooth: String(tooth) })} · ${lines.length ? lines.join(" · ") : t("healthy")}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-tooth={tooth}
          data-condition={mainCondition(state, conditions) ?? "healthy"}
          data-problem={problems.length > 0 || undefined}
          aria-pressed={selected}
          aria-label={label}
          disabled={disabled}
          onClick={() => onToggle(tooth)}
          style={{
            background: leadColor ? tint(leadColor, 0.82) : undefined,
            borderColor: problemColor ?? (leadColor ? tint(leadColor, 0.35) : undefined),
          }}
          className={cn(
            "relative flex h-16 w-11 flex-col items-center gap-1 border-2 border-slate-200 bg-white px-1 py-1 text-slate-700 transition-all duration-200 disabled:cursor-default",
            upper ? "rounded-t-xl rounded-b-md" : "flex-col-reverse rounded-t-md rounded-b-xl",
            state?.gone === "missing" && "border-dashed opacity-60",
            selected
              ? "ring-steel-300 z-10 scale-110 ring-4"
              : upper
                ? "hover:-translate-y-1 hover:shadow-md"
                : "hover:translate-y-1 hover:shadow-md",
            "focus-visible:ring-ring focus-visible:ring-4 focus-visible:outline-none",
          )}
        >
          <span className="text-xs leading-none font-bold">{tooth}</span>
          {state?.gone === "missing" ? (
            <svg viewBox="0 0 30 30" className="size-7 text-slate-500" aria-hidden>
              <path d="M5 5 L25 25 M25 5 L5 25" stroke="currentColor" strokeWidth="3" />
            </svg>
          ) : state?.gone === "implant" ? (
            <svg viewBox="0 0 30 30" className="size-7" style={{ color: leadColor }} aria-hidden>
              <path
                d="M8 4 H22 M10 9 H20 M11 14 H19 M12 19 H18 M13.5 24 H16.5 M15 4 V27"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <SurfaceDiagram
              tooth={tooth}
              colorOf={(s) => surfaceColor(state, s, conditions)}
              className="size-7"
            />
          )}

          {problems.length > 0 && (
            <span
              className={cn(
                "absolute -start-2 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-white",
                upper ? "-top-2" : "-bottom-2",
              )}
              style={{ background: problemColor }}
            >
              <TriangleAlertIcon className="size-2.5" />
            </span>
          )}
          {planned.length > 0 && (
            <span
              data-planned
              className={cn(
                "absolute -end-2 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-white",
                upper ? "-top-2" : "-bottom-2",
                inProgress ? "bg-amber-500" : "bg-blue-600",
              )}
            >
              <CalendarClockIcon className="size-2.5" />
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60 text-start">{label}</TooltipContent>
    </Tooltip>
  )
}

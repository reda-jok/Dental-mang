"use client"

import { useTranslations } from "next-intl"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { ToothState } from "../state"
import { isUpper, PERMANENT_ROWS, PRIMARY_ROWS } from "../teeth"

export type Dentition = "permanent" | "mixed" | "primary"

/**
 * Tile colour per condition (the clinic's original odontogram style).
 * Whole-tooth conditions win over surface conditions; the list is in priority order.
 */
const TILE_STYLES: { condition: string; className: string }[] = [
  {
    condition: "missing",
    className:
      "bg-slate-200 border-slate-400 text-slate-500 opacity-50 hover:bg-slate-300 line-through",
  },
  {
    condition: "implant",
    className: "bg-teal-100 border-teal-300 text-teal-700 hover:bg-teal-200",
  },
  {
    condition: "crown",
    className: "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200",
  },
  {
    condition: "bridge",
    className: "bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200",
  },
  { condition: "veneer", className: "bg-pink-100 border-pink-300 text-pink-700 hover:bg-pink-200" },
  {
    condition: "root_canal",
    className: "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200",
  },
  {
    condition: "root_remnant",
    className: "bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200",
  },
  {
    condition: "impacted",
    className: "bg-gray-100 border-gray-400 border-dashed text-gray-600 hover:bg-gray-200",
  },
  { condition: "caries", className: "bg-red-100 border-red-300 text-red-700 hover:bg-red-200" },
  {
    condition: "fracture",
    className: "bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200",
  },
  {
    condition: "filling",
    className: "bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200",
  },
]
const HEALTHY = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"

/** The condition that decides the tile's colour (or null when healthy). */
export function tileCondition(state: ToothState | undefined): string | null {
  if (!state) return null
  const present = new Set(state.marks.map((m) => m.condition))
  if (state.gone) present.add(state.gone)
  return TILE_STYLES.find((s) => present.has(s.condition))?.condition ?? null
}

export function tileClassName(condition: string | null) {
  return TILE_STYLES.find((s) => s.condition === condition)?.className ?? HEALTHY
}

type Props = {
  dentition: Dentition
  chart: Map<number, ToothState>
  selectedTeeth: Set<number>
  onToggleTooth: (tooth: number) => void
  disabled?: boolean
}

/**
 * Interactive odontogram, FDI numbering. Always laid out left-to-right with the
 * patient's right on the viewer's left — never mirrored by the RTL page.
 */
export function ToothChart({ dentition, chart, selectedTeeth, onToggleTooth, disabled }: Props) {
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

function ToothTile({
  tooth,
  state,
  selected,
  onToggle,
  disabled,
}: {
  tooth: number
  state: ToothState | undefined
  selected: boolean
  onToggle: (tooth: number) => void
  disabled?: boolean
}) {
  const t = useTranslations("chart")
  const upper = isUpper(tooth)
  const condition = tileCondition(state)
  const planned = state?.planned ?? []
  const inProgress = planned.some((p) => p.status === "in_progress")
  const surfaces = [...new Set((state?.marks ?? []).flatMap((m) => m.surfaces))].join("")

  const lines = [
    ...(state?.marks ?? []).map(
      (m) =>
        `${t(`conditions.${m.condition as "caries"}`)}${m.surfaces.length ? ` (${m.surfaces.join("")})` : ""}`,
    ),
    ...planned.map(
      (p) =>
        `${t("plannedOnTooth")}: ${p.procedureName}${p.surfaces.length ? ` (${p.surfaces.join("")})` : ""}`,
    ),
  ]
  const label = `${t("toothLabel", { tooth: String(tooth) })} · ${lines.length ? lines.join(" · ") : t("healthy")}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-tooth={tooth}
          data-condition={condition ?? "healthy"}
          aria-pressed={selected}
          aria-label={label}
          disabled={disabled}
          onClick={() => onToggle(tooth)}
          className={cn(
            "relative flex h-14 w-10 flex-col items-center justify-center border-2 transition-all duration-200 disabled:cursor-default",
            upper ? "rounded-t-lg rounded-b-sm" : "rounded-t-sm rounded-b-lg",
            tileClassName(condition),
            selected
              ? "z-10 scale-110 ring-4 ring-blue-300"
              : upper
                ? "hover:-translate-y-1 hover:shadow-md"
                : "hover:translate-y-1 hover:shadow-md",
            "focus-visible:ring-ring focus-visible:ring-4 focus-visible:outline-none",
          )}
        >
          {/* Crown area (biting side), as in the original chart */}
          {!upper && (
            <div className="mb-auto h-1/2 w-full rounded-t-sm border-b border-black/10 bg-white/40" />
          )}
          <span
            className={cn("absolute text-xs font-bold opacity-70", upper ? "top-1" : "bottom-1")}
          >
            {tooth}
          </span>
          {surfaces && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[9px] leading-none font-semibold">
              {surfaces}
            </span>
          )}
          {upper && (
            <div className="mt-auto h-1/2 w-full rounded-b-sm border-t border-black/10 bg-white/40" />
          )}

          {planned.length > 0 && (
            <span
              data-planned
              className={cn(
                "absolute -end-1 size-2.5 rounded-full border border-white",
                upper ? "-top-1" : "-bottom-1",
                inProgress ? "bg-amber-500" : "bg-blue-600",
              )}
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-start">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Legend dots matching the tile colours. */
export const LEGEND_DOTS: Record<string, string> = {
  caries: "bg-red-400",
  filling: "bg-blue-400",
  fracture: "bg-orange-400",
  crown: "bg-amber-400",
  root_canal: "bg-purple-400",
  missing: "bg-slate-300",
  implant: "bg-teal-400",
  bridge: "bg-yellow-400",
  veneer: "bg-pink-400",
  impacted: "bg-gray-400",
  root_remnant: "bg-rose-400",
}

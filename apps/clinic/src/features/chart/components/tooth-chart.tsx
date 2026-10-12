"use client"

import { CalendarClockIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, type KeyboardEvent, type MouseEvent } from "react"

import { cn } from "@/lib/utils"

import { mainCondition, problemsOf, surfaceColor, toothConditions, type ToothState } from "../state"
import {
  isUpper,
  mesialOnRight,
  PERMANENT_ROWS,
  PRIMARY_ROWS,
  SURFACES,
  tint,
  type Conditions,
  type Dentition,
  type Surface,
} from "../teeth"
import { CROWN_TOP, OCCLUSAL_BAND, SHAPES, toothKind } from "../tooth-shapes"

export type ToothTap = { tooth: number; surface: Surface | null; anchor: HTMLElement }

type Props = {
  dentition: Dentition
  chart: Map<number, ToothState>
  conditions: Conditions
  /** The tooth whose details or surface choice is open. */
  activeTooth: number | null
  onTap: (tap: ToothTap) => void
}

/**
 * Interactive odontogram, FDI numbering: each tooth seen from the side (crown and roots)
 * and from its biting side (five surfaces). Always laid out left-to-right with the
 * patient's right on the viewer's left — never mirrored by the RTL page.
 */
export function ToothChart({ dentition, chart, conditions, activeTooth, onTap }: Props) {
  const t = useTranslations("chart")

  const upperRows: (readonly number[])[] = []
  const lowerRows: (readonly number[])[] = []
  if (dentition !== "primary") upperRows.push(PERMANENT_ROWS[0])
  if (dentition !== "permanent") upperRows.push(PRIMARY_ROWS[0])
  if (dentition !== "permanent") lowerRows.push(PRIMARY_ROWS[1])
  if (dentition !== "primary") lowerRows.push(PERMANENT_ROWS[1])

  // Each half of a jaw has room for 8 teeth, so primary and permanent teeth line up.
  // When the chart is narrow (a phone, a tablet with the menu open) the two halves stack,
  // so the teeth stay big enough to tap: sized by the chart's own width, not the screen's.
  const half = (teeth: readonly number[], caption: string) => (
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground mb-0.5 text-center text-[11px] @2xl:hidden">{caption}</p>
      <div className="flex justify-center">
        {teeth.map((tooth) => (
          <div key={tooth} className="max-w-[60px] min-w-0 basis-[12.5%]">
            <ToothColumn
              tooth={tooth}
              state={chart.get(tooth)}
              conditions={conditions}
              active={activeTooth === tooth}
              onTap={onTap}
            />
          </div>
        ))}
      </div>
    </div>
  )
  const row = (teeth: readonly number[]) => (
    <div key={teeth[0]} className="flex flex-col gap-2 @2xl:flex-row @2xl:gap-3">
      {half(teeth.slice(0, teeth.length / 2), t("patientRight"))}
      {half(teeth.slice(teeth.length / 2), t("patientLeft"))}
    </div>
  )

  return (
    <div dir="ltr" className="@container flex w-full flex-col gap-1 px-1 py-2">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span className="hidden @2xl:inline">{t("patientRight")}</span>
        <span className="mx-auto @2xl:mx-0">{t("upper")}</span>
        <span className="hidden @2xl:inline">{t("patientLeft")}</span>
      </div>
      {upperRows.map(row)}
      <div className="bg-border my-2 h-px w-full" role="separator" />
      {lowerRows.map(row)}
      <p className="text-muted-foreground text-center text-xs">{t("lower")}</p>
    </div>
  )
}

const ENAMEL_LINE = "#94a3b8"
const ROOT_LINE = "#b9ab92"

function ToothColumn({
  tooth,
  state,
  conditions,
  active,
  onTap,
}: {
  tooth: number
  state: ToothState | undefined
  conditions: Conditions
  active: boolean
  onTap: (tap: ToothTap) => void
}) {
  const t = useTranslations("chart")
  const id = useId()
  const upper = isUpper(tooth)
  const shape = SHAPES[toothKind(tooth)]
  const colorOf = (s: Surface) => surfaceColor(state, s, conditions)
  const has = (code: string) => state?.marks.some((m) => m.condition === code) ?? false
  const color = (code: string) => conditions.get(code)?.color ?? "#64748b"
  const problems = problemsOf(state, conditions)
  const planned = state?.planned ?? []
  const inProgress = planned.some((p) => p.status === "in_progress")
  const missing = state?.gone === "missing"
  const implant = state?.gone === "implant"
  const remnant = has("root_remnant")
  // A whole-tooth condition tints the crown (the ones with their own drawing aside).
  const lead = toothConditions(state, conditions).find(
    (c) => !["root_canal", "implant", "missing", "root_remnant"].includes(c),
  )
  const leadColor = lead ? color(lead) : undefined
  const problemColor = problems[0] ? color(problems[0].condition) : undefined
  const left: Surface = mesialOnRight(tooth) ? "D" : "M"
  const right: Surface = mesialOnRight(tooth) ? "M" : "D"
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)

  const lines = [
    ...(state?.marks ?? []).map(
      (m) =>
        `${conditions.get(m.condition)?.name ?? m.condition}${m.surfaces.length ? ` (${m.surfaces.map(surfaceName).join("، ")})` : ""}`,
    ),
    ...planned.map((p) => `${t("plannedOnTooth")}: ${p.procedureName}`),
  ]
  const label = `${t("toothLabel", { tooth: String(tooth) })} · ${lines.length ? lines.join(" · ") : t("healthy")}`

  const tap = (e: MouseEvent<HTMLButtonElement>) => {
    const hit = (e.target as Element).closest("[data-surface],[data-side-surface]")
    const surface = (hit?.getAttribute("data-surface") ??
      hit?.getAttribute("data-side-surface") ??
      null) as Surface | null
    onTap({ tooth, surface, anchor: e.currentTarget })
  }
  // Keyboard: Enter is the whole tooth, a surface letter that surface.
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const surface = e.key.toUpperCase() as Surface
    if (!SURFACES.includes(surface)) return
    e.preventDefault()
    onTap({ tooth, surface, anchor: e.currentTarget })
  }

  // The biting surface seen from above (40 × 30): four sides around the middle.
  const o = shape.occlusal
  const [x0, y0] = [(40 - o.w) / 2, (30 - o.h) / 2]
  const [x1, y1] = [x0 + o.w, y0 + o.h]
  const [ix0, ix1, iy0, iy1] = [x0 + o.w * 0.3, x1 - o.w * 0.3, y0 + o.h * 0.3, y1 - o.h * 0.3]
  const outward: Surface = upper ? "B" : "L"
  const inward: Surface = upper ? "L" : "B"
  const occlusal = (
    <g opacity={missing ? 0.25 : 1}>
      <clipPath id={`${id}o`}>
        <rect x={x0} y={y0} width={o.w} height={o.h} rx={o.rx} ry={o.ry} />
      </clipPath>
      <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#e8edf3" />
      </linearGradient>
      <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f7f2e8" />
        <stop offset="1" stopColor="#e6dcc7" />
      </linearGradient>
      <g clipPath={`url(#${id}o)`}>
        {(
          [
            [outward, `M${x0} ${y0} H${x1} L${ix1} ${iy0} H${ix0} Z`],
            [inward, `M${x0} ${y1} H${x1} L${ix1} ${iy1} H${ix0} Z`],
            [left, `M${x0} ${y0} L${ix0} ${iy0} V${iy1} L${x0} ${y1} Z`],
            [right, `M${x1} ${y0} L${ix1} ${iy0} V${iy1} L${x1} ${y1} Z`],
            [
              "O",
              `M${ix0} ${(iy0 + iy1) / 2} a${(ix1 - ix0) / 2} ${(iy1 - iy0) / 2} 0 1 0 ${ix1 - ix0} 0 a${(ix1 - ix0) / 2} ${(iy1 - iy0) / 2} 0 1 0 ${ix0 - ix1} 0 Z`,
            ],
          ] as const
        ).map(([surface, d]) => (
          <path
            key={surface}
            d={d}
            data-surface={surface}
            data-color={colorOf(surface) ?? undefined}
            fill={colorOf(surface) ?? `url(#${id}e)`}
            stroke="#cbd5e1"
            strokeWidth={0.6}
          />
        ))}
      </g>
      <rect
        x={x0}
        y={y0}
        width={o.w}
        height={o.h}
        rx={o.rx}
        ry={o.ry}
        fill="none"
        stroke={leadColor ?? ENAMEL_LINE}
        strokeWidth={1}
        pointerEvents="none"
      />
    </g>
  )

  // Seen from the side, crown down (an upper tooth); lower teeth are flipped.
  const side = (
    <g transform={upper ? undefined : "translate(0 132) scale(1 -1)"}>
      <g opacity={missing ? 0.25 : 1} strokeDasharray={missing ? "2 2" : undefined}>
        {implant ? (
          <g stroke={color("implant")} strokeWidth={2} strokeLinecap="round">
            <path
              d="M14.5 56 L15.5 16 Q20 10 24.5 16 L25.5 56 Z"
              fill={tint(color("implant"), 0.75)}
            />
            {[22, 30, 38, 46].map((y) => (
              <path key={y} d={`M14 ${y} L26 ${y - 3}`} />
            ))}
          </g>
        ) : (
          <>
            <path
              d={shape.root}
              fill={remnant ? tint(color("root_remnant"), 0.6) : `url(#${id}r)`}
              stroke={remnant ? color("root_remnant") : ROOT_LINE}
              strokeWidth={1}
            />
            {has("root_canal") &&
              shape.canals.map((d) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke={color("root_canal")}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              ))}
          </>
        )}
        <g opacity={remnant ? 0.25 : 1}>
          <clipPath id={`${id}c`}>
            <path d={shape.crown} />
          </clipPath>
          <path d={shape.crown} fill={leadColor ? tint(leadColor, 0.55) : `url(#${id}e)`} />
          <g clipPath={`url(#${id}c)`}>
            {(
              [
                ["O", 0, OCCLUSAL_BAND, 40, 100 - OCCLUSAL_BAND],
                [left, 0, CROWN_TOP, 15, OCCLUSAL_BAND - CROWN_TOP],
                [right, 25, CROWN_TOP, 15, OCCLUSAL_BAND - CROWN_TOP],
                ["B", 15, CROWN_TOP, 10, OCCLUSAL_BAND - CROWN_TOP],
              ] as const
            ).map(([surface, x, y, w, h]) => (
              <rect
                key={surface}
                data-side-surface={surface}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={colorOf(surface) ?? "transparent"}
              />
            ))}
          </g>
          <path
            d={shape.crown}
            fill="none"
            stroke={leadColor ?? ENAMEL_LINE}
            strokeWidth={leadColor ? 1.6 : 1}
            pointerEvents="none"
          />
        </g>
      </g>
      {missing && <path d="M9 60 L31 94 M31 60 L9 94" stroke="#64748b" strokeWidth={2} />}
    </g>
  )

  return (
    <button
      type="button"
      data-tooth={tooth}
      data-condition={mainCondition(state, conditions) ?? "healthy"}
      data-problem={problems.length > 0 || undefined}
      aria-label={label}
      aria-keyshortcuts="M D O B L"
      aria-expanded={active}
      onClick={tap}
      onKeyDown={key}
      className={cn(
        "relative flex w-full flex-col items-center gap-0.5 rounded-lg px-px py-1 transition-colors",
        !upper && "flex-col-reverse",
        active ? "bg-accent ring-primary ring-1" : "hover:bg-accent",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <span className="text-foreground text-[11px] leading-none font-bold">{tooth}</span>
      <svg viewBox="0 0 40 132" className="h-auto w-full" aria-hidden>
        {upper ? (
          <>
            {side}
            <g transform="translate(0 102)">{occlusal}</g>
          </>
        ) : (
          <>
            {occlusal}
            {side}
          </>
        )}
      </svg>
      <span className="flex h-3.5 items-center gap-0.5">
        {problems.length > 0 && (
          <span
            className="flex size-3.5 items-center justify-center rounded-full text-white"
            style={{ background: problemColor }}
          >
            <TriangleAlertIcon className="size-2.5" />
          </span>
        )}
        {planned.length > 0 && (
          <span
            data-planned
            className={cn(
              "flex size-3.5 items-center justify-center rounded-full text-white",
              inProgress ? "bg-amber-500" : "bg-blue-600",
            )}
          >
            <CalendarClockIcon className="size-2.5" />
          </span>
        )}
      </span>
    </button>
  )
}

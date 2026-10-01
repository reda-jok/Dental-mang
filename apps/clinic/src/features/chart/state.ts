// What each tooth looks like on the chart: recorded findings, treatment already done,
// and treatment planned. Pure, so the drawing logic is fully unit-tested.

import { conditionInfo, isToothGone, normalizeSurfaces, type Surface } from "./teeth"

export type FindingInput = { id: string; tooth: number; surfaces: string[]; condition: string }
export type PlanItemInput = {
  id: string
  tooth: number | null
  surfaces: string[]
  status: "planned" | "in_progress" | "done" | "cancelled"
  procedureName: string
  chartResult: string | null
}

export type ToothMark = {
  condition: string
  /** Empty = whole tooth. */
  surfaces: Surface[]
  source: "finding" | "treatment"
  /** Finding id (so it can be resolved) or plan item id. */
  id: string
}

export type ToothState = {
  marks: ToothMark[]
  planned: {
    id: string
    procedureName: string
    surfaces: Surface[]
    status: "planned" | "in_progress"
  }[]
  /** Missing or replaced by an implant: drawn differently. */
  gone: "missing" | "implant" | null
}

export function emptyToothState(): ToothState {
  return { marks: [], planned: [], gone: null }
}

export function buildChartState(
  findings: FindingInput[],
  items: PlanItemInput[],
): Map<number, ToothState> {
  const chart = new Map<number, ToothState>()
  const at = (tooth: number) => {
    let state = chart.get(tooth)
    if (!state) chart.set(tooth, (state = emptyToothState()))
    return state
  }

  for (const f of findings) {
    if (!conditionInfo(f.condition)) continue
    at(f.tooth).marks.push({
      condition: f.condition,
      surfaces: normalizeSurfaces(f.surfaces),
      source: "finding",
      id: f.id,
    })
  }

  for (const item of items) {
    if (item.tooth === null || item.status === "cancelled") continue
    const surfaces = normalizeSurfaces(item.surfaces)
    if (item.status === "done") {
      if (item.chartResult && conditionInfo(item.chartResult)) {
        at(item.tooth).marks.push({
          condition: item.chartResult,
          surfaces,
          source: "treatment",
          id: item.id,
        })
      }
    } else {
      at(item.tooth).planned.push({
        id: item.id,
        procedureName: item.procedureName,
        surfaces,
        status: item.status,
      })
    }
  }

  for (const state of chart.values()) {
    // Treatment done by us is more recent than a finding: e.g. a filling done on a carious
    // surface replaces the caries on that surface.
    const treatedSurfaces = new Set(
      state.marks.filter((m) => m.source === "treatment").flatMap((m) => m.surfaces),
    )
    const toothTreated = state.marks.some(
      (m) => m.source === "treatment" && m.surfaces.length === 0,
    )
    state.marks = state.marks.filter(
      (m) =>
        m.source === "treatment" ||
        m.condition !== "caries" ||
        !(toothTreated || m.surfaces.some((s) => treatedSurfaces.has(s))),
    )

    const gone = state.marks.find((m) => isToothGone(m.condition))
    // An implant placed later wins over "missing".
    state.gone = state.marks.some((m) => m.condition === "implant")
      ? "implant"
      : gone
        ? "missing"
        : null
  }
  return chart
}

/** Colour for a surface: the latest mark that covers it (or the whole tooth). */
export function surfaceColor(state: ToothState | undefined, surface: Surface): string | null {
  if (!state) return null
  for (let i = state.marks.length - 1; i >= 0; i--) {
    const mark = state.marks[i]!
    const info = conditionInfo(mark.condition)
    if (info?.scope === "surfaces" && mark.surfaces.includes(surface)) return info.color
  }
  return null
}

/** Whole-tooth conditions to draw as rings/markers (crown, root canal…). */
export function wholeToothConditions(state: ToothState | undefined): string[] {
  if (!state) return []
  return [
    ...new Set(
      state.marks
        .filter((m) => conditionInfo(m.condition)?.scope === "tooth" || m.surfaces.length === 0)
        .map((m) => m.condition),
    ),
  ]
}

// What each tooth looks like on the chart: recorded findings, treatment already done,
// and treatment planned. Pure, so the drawing logic is fully unit-tested.

import { isToothGone, normalizeSurfaces, type Conditions, type Surface } from "./teeth"

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
  conditions: Conditions,
): Map<number, ToothState> {
  const chart = new Map<number, ToothState>()
  const at = (tooth: number) => {
    let state = chart.get(tooth)
    if (!state) chart.set(tooth, (state = emptyToothState()))
    return state
  }

  for (const f of findings) {
    if (!conditions.has(f.condition)) continue
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
      if (item.chartResult && conditions.has(item.chartResult)) {
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
    // Treatment done by us is more recent than a finding: a filling done on a carious
    // surface clears the caries there, a crown or an extraction clears the whole tooth.
    const treatedSurfaces = new Set(
      state.marks.filter((m) => m.source === "treatment").flatMap((m) => m.surfaces),
    )
    const toothTreated = state.marks.some(
      (m) => m.source === "treatment" && m.surfaces.length === 0,
    )
    state.marks = state.marks.filter(
      (m) =>
        m.source === "treatment" ||
        conditions.get(m.condition)?.kind !== "problem" ||
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

/** Does the mark cover the surface? A surface condition on no surfaces covers them all. */
function covers(mark: ToothMark, surface: Surface, conditions: Conditions) {
  return (
    conditions.get(mark.condition)?.scope === "surfaces" &&
    (mark.surfaces.length === 0 || mark.surfaces.includes(surface))
  )
}

/** Colour of a surface: the latest surface mark that covers it. */
export function surfaceColor(
  state: ToothState | undefined,
  surface: Surface,
  conditions: Conditions,
): string | null {
  const mark = [...(state?.marks ?? [])].reverse().find((m) => covers(m, surface, conditions))
  return mark ? conditions.get(mark.condition)!.color : null
}

/** Whole-tooth conditions (crown, root canal…), problems first, then the latest. */
export function toothConditions(state: ToothState | undefined, conditions: Conditions): string[] {
  const codes = [
    ...new Set(
      (state?.marks ?? [])
        .filter((m) => conditions.get(m.condition)?.scope === "tooth")
        .map((m) => m.condition)
        .reverse(),
    ),
  ]
  return codes.sort(
    (a, b) =>
      Number(conditions.get(b)?.kind === "problem") - Number(conditions.get(a)?.kind === "problem"),
  )
}

/** Problems still on the tooth (what needs treatment), with the surfaces they cover. */
export function problemsOf(state: ToothState | undefined, conditions: Conditions): ToothMark[] {
  return (state?.marks ?? []).filter((m) => conditions.get(m.condition)?.kind === "problem")
}

/**
 * The one condition that names the tooth (tests and screen readers): a problem first,
 * then a missing tooth or implant, then whole-tooth work, then surface work.
 */
export function mainCondition(state: ToothState | undefined, conditions: Conditions) {
  if (!state) return null
  const problem = problemsOf(state, conditions)[0]
  if (problem) return problem.condition
  if (state.gone) return state.gone
  const tooth = toothConditions(state, conditions)[0]
  if (tooth) return tooth
  const surface = [...state.marks]
    .reverse()
    .find((m) => conditions.get(m.condition)?.scope === "surfaces")
  return surface?.condition ?? null
}

import { describe, expect, it } from "vitest"

import {
  buildChartState as build,
  mainCondition,
  problemsOf,
  surfaceColor as colorOf,
  toothConditions,
  type FindingInput,
  type PlanItemInput,
  type ToothState,
} from "./state"
import { TOOTH_CONDITIONS, type ConditionInfo, type Surface } from "./teeth"

/** The built-ins plus a clinic's own whole-tooth problem. */
const conditions = new Map<string, ConditionInfo>(
  [
    ...TOOTH_CONDITIONS,
    { code: "abscess", scope: "tooth", kind: "problem", color: "#c026d3" } as const,
  ].map((c) => [c.code, { ...c, name: c.code, hidden: false }]),
)
const buildChartState = (findings: FindingInput[], items: PlanItemInput[]) =>
  build(findings, items, conditions)
const surfaceColor = (state: ToothState | undefined, s: Surface) => colorOf(state, s, conditions)

const item = (over: Partial<PlanItemInput>): PlanItemInput => ({
  id: "i1",
  tooth: 16,
  surfaces: [],
  status: "planned",
  procedureName: "حشوة",
  chartResult: "filling",
  ...over,
})

describe("buildChartState", () => {
  it("draws findings on their surfaces", () => {
    const chart = buildChartState(
      [{ id: "f1", tooth: 16, surfaces: ["O", "M"], condition: "caries" }],
      [],
    )
    const tooth = chart.get(16)!
    expect(surfaceColor(tooth, "O")).toBe("#dc2626")
    expect(surfaceColor(tooth, "M")).toBe("#dc2626")
    expect(surfaceColor(tooth, "D")).toBeNull()
  })

  it("shows planned treatment separately from what is on the tooth", () => {
    const chart = buildChartState([], [item({ surfaces: ["O"] })])
    expect(chart.get(16)!.planned).toEqual([
      { id: "i1", procedureName: "حشوة", surfaces: ["O"], status: "planned" },
    ])
    expect(surfaceColor(chart.get(16), "O")).toBeNull()
  })

  it("draws done treatment as its chart result, replacing caries on treated surfaces", () => {
    const chart = buildChartState(
      [{ id: "f1", tooth: 16, surfaces: ["O", "D"], condition: "caries" }],
      [item({ status: "done", surfaces: ["O", "D"] })],
    )
    expect(surfaceColor(chart.get(16), "O")).toBe("#2563eb") // filling, not caries
    expect(chart.get(16)!.marks.map((m) => m.condition)).toEqual(["filling"])
  })

  it("keeps caries on surfaces that weren't treated", () => {
    const chart = buildChartState(
      [{ id: "f1", tooth: 16, surfaces: ["M"], condition: "caries" }],
      [item({ status: "done", surfaces: ["O"] })],
    )
    expect(surfaceColor(chart.get(16), "M")).toBe("#dc2626")
  })

  it("marks extracted teeth missing and an implant placed later wins", () => {
    const extracted = buildChartState([], [item({ status: "done", chartResult: "missing" })])
    expect(extracted.get(16)!.gone).toBe("missing")

    const implanted = buildChartState(
      [{ id: "f1", tooth: 16, surfaces: [], condition: "missing" }],
      [item({ status: "done", chartResult: "implant" })],
    )
    expect(implanted.get(16)!.gone).toBe("implant")
  })

  it("ignores cancelled items, whole-mouth items and unknown conditions", () => {
    const chart = buildChartState(
      [{ id: "f1", tooth: 11, surfaces: [], condition: "not_a_condition" }],
      [item({ status: "cancelled" }), item({ tooth: null, chartResult: null })],
    )
    expect(chart.get(16)).toBeUndefined()
    expect(chart.get(11)).toBeUndefined()
  })

  it("lists whole-tooth conditions, problems first, then the latest", () => {
    const chart = buildChartState(
      [
        { id: "f1", tooth: 21, surfaces: [], condition: "crown" },
        { id: "f2", tooth: 21, surfaces: [], condition: "root_canal" },
        { id: "f3", tooth: 21, surfaces: [], condition: "abscess" },
      ],
      [],
    )
    expect(toothConditions(chart.get(21), conditions)).toEqual(["abscess", "root_canal", "crown"])
  })

  it("a surface condition recorded on the whole tooth covers every surface", () => {
    const chart = buildChartState([{ id: "f1", tooth: 16, surfaces: [], condition: "caries" }], [])
    expect(surfaceColor(chart.get(16), "B")).toBe("#dc2626")
  })

  it("any problem, the clinic's own too, is cleared by a treatment on that tooth", () => {
    const chart = buildChartState(
      [
        { id: "f1", tooth: 36, surfaces: [], condition: "abscess" },
        { id: "f2", tooth: 36, surfaces: ["O"], condition: "fracture" },
      ],
      [item({ tooth: 36, status: "done", chartResult: "root_canal" })],
    )
    expect(problemsOf(chart.get(36), conditions)).toEqual([])
    expect(mainCondition(chart.get(36), conditions)).toBe("root_canal")
  })

  it("names the tooth by its problem first", () => {
    const chart = buildChartState(
      [
        { id: "f1", tooth: 26, surfaces: [], condition: "crown" },
        { id: "f2", tooth: 26, surfaces: ["M"], condition: "caries" },
        { id: "f3", tooth: 27, surfaces: ["O"], condition: "filling" },
      ],
      [],
    )
    expect(mainCondition(chart.get(26), conditions)).toBe("caries")
    expect(mainCondition(chart.get(27), conditions)).toBe("filling")
    expect(mainCondition(chart.get(28), conditions)).toBeNull()
  })
})

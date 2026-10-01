import { describe, expect, it } from "vitest"

import { buildChartState, surfaceColor, wholeToothConditions, type PlanItemInput } from "./state"

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

  it("lists whole-tooth conditions for rings and markers", () => {
    const chart = buildChartState(
      [
        { id: "f1", tooth: 21, surfaces: [], condition: "crown" },
        { id: "f2", tooth: 21, surfaces: [], condition: "root_canal" },
      ],
      [],
    )
    expect(wholeToothConditions(chart.get(21))).toEqual(["crown", "root_canal"])
  })
})

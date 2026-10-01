import { describe, expect, it } from "vitest"

import {
  canChangeItemStatus,
  canChangePlanStatus,
  isPlanOpen,
  planItemTargets,
  shouldCompletePlan,
} from "./rules"

describe("planItemTargets", () => {
  it("whole-mouth procedures get one item without a tooth", () => {
    expect(planItemTargets("none", [], [])).toEqual({
      ok: true,
      targets: [{ tooth: null, surfaces: [] }],
    })
    expect(planItemTargets("none", [16], [])).toEqual({ ok: false, error: "teethNotAllowed" })
  })

  it("per-tooth procedures get one item per tooth, without surfaces", () => {
    expect(planItemTargets("tooth", [36, 46, 36], ["O"])).toEqual({
      ok: true,
      targets: [
        { tooth: 36, surfaces: [] },
        { tooth: 46, surfaces: [] },
      ],
    })
    expect(planItemTargets("tooth", [], [])).toEqual({ ok: false, error: "teethRequired" })
  })

  it("surface procedures require surfaces and normalize them", () => {
    expect(planItemTargets("surfaces", [16], ["O", "M", "O"])).toEqual({
      ok: true,
      targets: [{ tooth: 16, surfaces: ["M", "O"] }],
    })
    expect(planItemTargets("surfaces", [16], [])).toEqual({ ok: false, error: "surfacesRequired" })
  })

  it("rejects teeth that don't exist", () => {
    expect(planItemTargets("tooth", [19], [])).toEqual({ ok: false, error: "invalidTooth" })
  })
})

describe("status rules", () => {
  it("items move forward, done is final, cancelled can be reopened", () => {
    expect(canChangeItemStatus("planned", "in_progress")).toBe(true)
    expect(canChangeItemStatus("in_progress", "done")).toBe(true)
    expect(canChangeItemStatus("done", "planned")).toBe(false)
    expect(canChangeItemStatus("done", "cancelled")).toBe(false)
    expect(canChangeItemStatus("cancelled", "planned")).toBe(true)
    expect(canChangeItemStatus("cancelled", "done")).toBe(false)
  })

  it("plans: completed is final; only open plans take changes", () => {
    expect(canChangePlanStatus("proposed", "accepted")).toBe(true)
    expect(canChangePlanStatus("completed", "cancelled")).toBe(false)
    expect(isPlanOpen("accepted")).toBe(true)
    expect(isPlanOpen("completed")).toBe(false)
    expect(isPlanOpen("cancelled")).toBe(false)
  })

  it("completes a plan when every non-cancelled item is done", () => {
    expect(shouldCompletePlan([{ status: "done" }, { status: "cancelled" }])).toBe(true)
    expect(shouldCompletePlan([{ status: "done" }, { status: "planned" }])).toBe(false)
    expect(shouldCompletePlan([{ status: "cancelled" }])).toBe(false)
    expect(shouldCompletePlan([])).toBe(false)
  })
})

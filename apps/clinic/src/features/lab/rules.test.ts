import { describe, expect, it } from "vitest"

import { actionsFor, canDo, dueState, parseTeeth } from "./rules"

describe("lab case steps", () => {
  it("goes sent → received → fitted, can be sent back, and ends at fitted or cancelled", () => {
    expect(actionsFor("sent")).toEqual(["receive", "cancel"])
    expect(actionsFor("received")).toEqual(["fit", "remake", "cancel"])
    expect(actionsFor("fitted")).toEqual([])
    expect(actionsFor("cancelled")).toEqual([])
    expect(canDo("sent", "fit")).toBe(false)
    expect(canDo("received", "remake")).toBe(true)
  })
})

describe("dueState", () => {
  const today = "2026-10-01"
  it("says how a case at the lab stands against its due date", () => {
    expect(dueState("sent", "2026-09-30", today)).toBe("late")
    expect(dueState("sent", "2026-10-01", today)).toBe("today")
    expect(dueState("sent", "2026-10-03", today)).toBe("soon")
    expect(dueState("sent", "2026-10-04", today)).toBe("onTime")
  })

  it("only applies to work at the lab", () => {
    expect(dueState("received", "2026-09-01", today)).toBeNull()
    expect(dueState("fitted", "2026-09-01", today)).toBeNull()
  })
})

describe("parseTeeth", () => {
  it("reads teeth typed in any common way", () => {
    expect(parseTeeth("16, 17")).toEqual([16, 17])
    expect(parseTeeth("١٦ ١٧")).toEqual([16, 17])
    expect(parseTeeth("36-37-36")).toEqual([36, 37])
    expect(parseTeeth("")).toEqual([])
  })

  it("refuses numbers that aren't teeth", () => {
    expect(parseTeeth("19")).toBeNull()
    expect(parseTeeth("6")).toBeNull()
    expect(parseTeeth("16 abc")).toBeNull()
  })
})

import { describe, expect, it } from "vitest"

import { resolveLayout, WIDGET_KEYS, type WidgetKey } from "./widgets"

const all = new Set<WidgetKey>(WIDGET_KEYS)

describe("resolveLayout", () => {
  it("no saved layout: every allowed widget in the default order", () => {
    const allowed = new Set<WidgetKey>(["calendar", "totalPatients"])
    expect(resolveLayout(null, allowed)).toEqual([
      { key: "totalPatients", hidden: false },
      { key: "calendar", hidden: false },
    ])
  })

  it("keeps the saved order and hidden flags, then appends widgets it doesn't mention", () => {
    const layout = resolveLayout(
      [
        { key: "calendar", hidden: true },
        { key: "todayCount", hidden: false },
      ],
      all,
    )
    expect(layout.slice(0, 2)).toEqual([
      { key: "calendar", hidden: true },
      { key: "todayCount", hidden: false },
    ])
    expect(layout).toHaveLength(WIDGET_KEYS.length)
    expect(layout.slice(2).every((i) => !i.hidden)).toBe(true)
  })

  it("drops unknown, repeated and not-allowed widgets", () => {
    const allowed = new Set<WidgetKey>(["calendar", "todayCount"])
    const layout = resolveLayout(
      [
        { key: "removedWidget", hidden: false },
        { key: "treatmentValue", hidden: false }, // not allowed for this role
        { key: "todayCount", hidden: true },
        { key: "todayCount", hidden: false },
      ],
      allowed,
    )
    expect(layout).toEqual([
      { key: "todayCount", hidden: true },
      { key: "calendar", hidden: false },
    ])
  })
})

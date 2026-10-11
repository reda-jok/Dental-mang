import { describe, expect, it } from "vitest"

import { attendanceRates, busyGrid, heatStep, topProcedures } from "./stats"

describe("attendanceRates", () => {
  it("no-shows among finished + missed visits; cancellations among all booked", () => {
    const r = attendanceRates({ completed: 18, no_show: 2, cancelled: 5, pending: 5 })
    expect(r.noShowRate).toBe(0.1)
    expect(r.cancelRate).toBe(5 / 30)
    expect(r.booked).toBe(30)
  })

  it("has no rate when there is nothing to divide by", () => {
    expect(attendanceRates({})).toMatchObject({ noShowRate: null, cancelRate: null })
    expect(attendanceRates({ cancelled: 2 })).toMatchObject({ noShowRate: null, cancelRate: 1 })
  })
})

describe("topProcedures", () => {
  it("ranks by count, then value, with exact totals and a share of the top one", () => {
    const items = [
      { procedureId: "f", name: "حشوة", net: "25000" },
      { procedureId: "f", name: "حشوة", net: "25000" },
      { procedureId: "c", name: "تاج", net: "150000" },
      { procedureId: "x", name: "قلع", net: "20000" },
      { procedureId: "f", name: "حشوة", net: "20000.50" },
    ]
    expect(topProcedures(items, 2)).toEqual([
      { procedureId: "f", name: "حشوة", count: 3, value: "70000.50", share: 1 },
      { procedureId: "c", name: "تاج", count: 1, value: "150000", share: 1 / 3 },
    ])
    expect(topProcedures([])).toEqual([])
  })
})

describe("busyGrid", () => {
  it("counts appointments per weekday and hour, rows in the clinic's order", () => {
    const g = busyGrid(
      [
        { weekday: 6, hour: 16 },
        { weekday: 6, hour: 16 },
        { weekday: 0, hour: 17 },
        { weekday: 5, hour: 16 }, // a closed day: not a row, not counted
      ],
      [6, 0],
      [16, 17],
    )
    expect(g.rows).toEqual([
      { weekday: 6, cells: [2, 0] },
      { weekday: 0, cells: [0, 1] },
    ])
    expect(g.max).toBe(2)
  })

  it("shades 0 for empty cells and 1-5 by share of the busiest", () => {
    expect([0, 1, 5, 10].map((n) => heatStep(n, 10))).toEqual([0, 1, 3, 5])
    expect(heatStep(3, 0)).toBe(0)
  })
})

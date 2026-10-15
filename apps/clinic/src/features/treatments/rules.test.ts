import { describe, expect, it } from "vitest"

import { daysBetween, planProgress, tally, type ListItem } from "./rules"

const item = (over: Partial<ListItem>): ListItem => ({
  status: "planned",
  phase: 1,
  price: "100000",
  discount: "0",
  tooth: null,
  procedureName: "حشوة",
  dentistName: "د. سارة",
  ...over,
})

describe("planProgress", () => {
  it("counts done of the active treatments, the value left after discounts, and the next phase", () => {
    const progress = planProgress([
      item({ status: "done", phase: 1, procedureName: "تنظيف" }),
      item({ status: "cancelled", phase: 1, price: "999999" }),
      item({
        status: "in_progress",
        phase: 2,
        procedureName: "علاج عصب",
        tooth: 16,
        discount: "20000",
      }),
      item({
        status: "planned",
        phase: 2,
        procedureName: "تاج",
        tooth: 16,
        dentistName: "د. حيدر",
      }),
      item({ status: "planned", phase: 3, procedureName: "زراعة", dentistName: null }),
    ])
    expect(progress).toEqual({
      done: 1,
      total: 4,
      left: "280000",
      dentists: ["د. سارة", "د. حيدر"],
      next: [
        { procedureName: "علاج عصب", tooth: 16 },
        { procedureName: "تاج", tooth: 16 },
      ],
    })
  })

  it("has nothing next once every treatment is done", () => {
    expect(planProgress([item({ status: "done" })])).toMatchObject({
      done: 1,
      total: 1,
      left: "0",
      next: [],
    })
  })
})

describe("tally", () => {
  it("counts and sums per key, biggest value first", () => {
    const rows = [
      { who: "a", price: "100000", discount: "0" },
      { who: "b", price: "300000", discount: "50000" },
      { who: "a", price: "50000", discount: "0" },
      { who: "c", price: "150000", discount: "0" },
    ]
    expect(tally(rows, (r) => ({ key: r.who, label: r.who.toUpperCase() }))).toEqual([
      { key: "b", label: "B", count: 1, amount: "250000" },
      { key: "a", label: "A", count: 2, amount: "150000" },
      { key: "c", label: "C", count: 1, amount: "150000" },
    ])
  })
})

describe("daysBetween", () => {
  it("counts calendar days, across months", () => {
    expect(daysBetween("2026-09-28", "2026-10-13")).toBe(15)
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0)
  })
})

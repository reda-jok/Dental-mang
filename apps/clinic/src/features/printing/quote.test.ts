import { describe, expect, it } from "vitest"

import { fromMinor, toMinor } from "@/lib/money"

import { dentitionForAge } from "../chart/teeth"
import { chairTime, chartDentition, paymentSchedule, quoteOptionsSchema } from "./quote"

const phases = [
  { phase: 1, net: "300000" },
  { phase: 2, net: "1250000" },
  { phase: 3, net: "450000" },
]
const sum = (lines: { amount: string }[]) =>
  fromMinor(lines.reduce((s, l) => s + toMinor(l.amount), 0n))

describe("paymentSchedule", () => {
  it("pays in full: one line with what's left", () => {
    const r = paymentSchedule({ phases, paid: "0", mode: "full", months: 6, depositPercent: 0 })
    expect(r).toEqual({ remaining: "2000000", lines: [{ kind: "now", amount: "2000000" }] })
  })

  it("per phase: what's paid covers the earliest phases first", () => {
    const r = paymentSchedule({
      phases,
      paid: "500000",
      mode: "phase",
      months: 6,
      depositPercent: 0,
    })
    expect(r.lines).toEqual([
      { kind: "phase", phase: 2, amount: "1050000" },
      { kind: "phase", phase: 3, amount: "450000" },
    ])
    expect(sum(r.lines)).toBe(r.remaining)
  })

  it("monthly: deposit, whole thousands, and the last month takes the remainder", () => {
    const odd = [{ phase: 1, net: "1234567" }]
    const r = paymentSchedule({
      phases: odd,
      paid: "0",
      mode: "months",
      months: 6,
      depositPercent: 30,
    })
    expect(r.lines[0]).toEqual({ kind: "deposit", amount: "370000" })
    const months = r.lines.filter((l) => l.kind === "month")
    expect(months).toHaveLength(6)
    expect(months.slice(0, 5).every((l) => l.amount === "144000")).toBe(true)
    expect(sum(r.lines)).toBe("1234567")
  })

  it("small amounts are split in whole dinars and still add up", () => {
    const r = paymentSchedule({
      phases: [{ phase: 1, net: "2500" }],
      paid: "0",
      mode: "months",
      months: 3,
      depositPercent: 0,
    })
    expect(r.lines.map((l) => l.amount)).toEqual(["833", "833", "834"])
  })

  it("nothing left to pay: no lines", () => {
    const r = paymentSchedule({
      phases,
      paid: "2500000",
      mode: "months",
      months: 3,
      depositPercent: 20,
    })
    expect(r).toEqual({ remaining: "0", lines: [] })
  })
})

describe("chairTime", () => {
  it("adds the catalog durations per phase, rounded up to a quarter hour", () => {
    const t = chairTime([
      { phase: 1, durationMinutes: 30 },
      { phase: 1, durationMinutes: 20 },
      { phase: 2, durationMinutes: null },
    ])
    expect(t.get(1)).toBe(60)
    expect(t.get(2)).toBe(0)
  })
})

describe("quoteOptionsSchema", () => {
  it("falls back to safe defaults for anything unexpected", () => {
    expect(quoteOptionsSchema.parse({ copies: "x", months: "7", deposit: "abc" })).toEqual({
      copies: "both",
      pay: undefined,
      months: 6,
      deposit: 0,
    })
    expect(quoteOptionsSchema.parse({ pay: "months", months: "12", deposit: "30" })).toMatchObject({
      pay: "months",
      months: 12,
      deposit: 30,
    })
  })
})

describe("dentitionForAge", () => {
  it("primary under 6, mixed until 12, permanent otherwise or unknown", () => {
    expect([5, 6, 11, 12, null].map(dentitionForAge)).toEqual([
      "primary",
      "mixed",
      "mixed",
      "permanent",
      "permanent",
    ])
  })
})

describe("chartDentition", () => {
  it("widens to mixed when the plan has teeth the age wouldn't show", () => {
    expect(chartDentition(null, [36, 11])).toBe("permanent")
    expect(chartDentition(null, [36, 75])).toBe("mixed")
    expect(chartDentition(4, [54])).toBe("primary")
    expect(chartDentition(4, [16])).toBe("mixed")
  })
})

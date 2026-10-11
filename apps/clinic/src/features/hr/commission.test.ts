import { describe, expect, it } from "vitest"

import {
  commissionOf,
  dentistMonth,
  lineForPeriod,
  payFor,
  type CommissionLine,
  type PayVersion,
} from "./commission"

const d = (iso: string) => new Date(`${iso}T12:00:00Z`)
const OCT = [d("2026-10-01"), d("2026-11-01")] as const
const NOV = [d("2026-11-01"), d("2026-12-01")] as const
const minor = (n: number) => BigInt(n * 100)

/** A crown line worth 500,000 on its own invoice. */
const crown = (over: Partial<CommissionLine> = {}): CommissionLine => ({
  lineId: "crown",
  lineTotal: "500000",
  linesTotal: "500000",
  invoiceTotal: "500000",
  allocations: [],
  labBills: [],
  ...over,
})

describe("lineForPeriod", () => {
  it("earns from what was collected in the period", () => {
    const line = crown({ allocations: [{ amount: "200000", at: d("2026-10-05"), until: null }] })
    expect(lineForPeriod(line, ...OCT, false)).toEqual({
      collected: minor(200000),
      lab: 0n,
      base: minor(200000),
    })
    expect(lineForPeriod(line, ...NOV, false).collected).toBe(0n)
  })

  it("takes the lab cost off in proportion to what is paid", () => {
    // Paid 40% of the crown: 40% of the 150,000 lab bill comes off.
    const line = crown({
      allocations: [{ amount: "200000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "150000", at: d("2026-10-02") }],
    })
    expect(lineForPeriod(line, ...OCT, true)).toEqual({
      collected: minor(200000),
      lab: minor(60000),
      base: minor(140000),
    })
  })

  it("catches up a lab bill that arrives after the payment, in the month it arrives", () => {
    const line = crown({
      allocations: [{ amount: "500000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "150000", at: d("2026-11-03") }],
    })
    expect(lineForPeriod(line, ...OCT, true).base).toBe(minor(500000))
    expect(lineForPeriod(line, ...NOV, true)).toEqual({
      collected: 0n,
      lab: minor(150000),
      base: -minor(150000),
    })
  })

  it("a void lowers the month of the void, not the month of the payment", () => {
    const line = crown({
      allocations: [{ amount: "300000", at: d("2026-10-05"), until: d("2026-11-10") }],
    })
    expect(lineForPeriod(line, ...OCT, false).base).toBe(minor(300000))
    expect(lineForPeriod(line, ...NOV, false).base).toBe(-minor(300000))
  })

  it("splits an invoice between its lines by line total, extra discount included", () => {
    // Lines 300,000 (this dentist) + 200,000, invoice total 450,000 after a 50,000 discount.
    const line = crown({
      lineTotal: "300000",
      linesTotal: "500000",
      invoiceTotal: "450000",
      allocations: [{ amount: "450000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "90000", at: d("2026-10-01") }],
    })
    // 60% of 450,000 = 270,000 collected for this line; fully paid, so all of the lab cost.
    expect(lineForPeriod(line, ...OCT, true)).toEqual({
      collected: minor(270000),
      lab: minor(90000),
      base: minor(180000),
    })
  })

  it("works in whole dinars, so collected − lab = base exactly", () => {
    // One third of 100,000 → 33,333 (not 33,333.33); the lab third of 50,000 → 16,667.
    const line = crown({
      lineTotal: "100000",
      linesTotal: "300000",
      invoiceTotal: "300000",
      allocations: [{ amount: "100000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "50000", at: d("2026-10-01") }],
    })
    const r = lineForPeriod(line, ...OCT, true)
    expect(r.collected).toBe(minor(33333))
    expect(r.collected - r.lab).toBe(r.base)
    expect(r.base % 100n).toBe(0n)
  })

  it("never goes below zero when the lab costs more than the line", () => {
    const line = crown({
      allocations: [{ amount: "100000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "900000", at: d("2026-10-01") }],
    })
    expect(lineForPeriod(line, ...OCT, true).base).toBe(0n)
  })
})

describe("commissionOf", () => {
  it("applies the rate and rounds to whole dinars", () => {
    expect(commissionOf(minor(140000), "30")).toBe(minor(42000))
    expect(commissionOf(minor(33333), "12.5")).toBe(minor(4167)) // 4166.625 → 4167
    expect(commissionOf(-minor(150000), "20")).toBe(-minor(30000))
  })
})

describe("payFor", () => {
  const v = (effectiveFrom: string, rate: string, at = "2026-01-01"): PayVersion => ({
    payType: "commission",
    commissionRate: rate,
    monthlySalary: null,
    deductLab: true,
    effectiveFrom,
    createdAt: d(at),
  })
  it("uses the latest version that started on or before the month", () => {
    const versions = [v("2026-01", "30"), v("2026-11", "35"), v("2026-11", "40", "2026-10-20")]
    expect(payFor(versions, "2026-10")?.commissionRate).toBe("30")
    expect(payFor(versions, "2026-11")?.commissionRate).toBe("40") // set later wins
    expect(payFor(versions, "2025-12")).toBeNull()
  })
})

describe("dentistMonth", () => {
  const lines = [
    crown({
      allocations: [{ amount: "200000", at: d("2026-10-05"), until: null }],
      labBills: [{ cost: "150000", at: d("2026-10-02") }],
    }),
  ]
  const pay = (payType: PayVersion["payType"]): PayVersion => ({
    payType,
    commissionRate: "30",
    monthlySalary: payType === "commission" ? null : "750000",
    deductLab: true,
    effectiveFrom: "2026-01",
    createdAt: d("2026-01-01"),
  })

  it("adds salary and commission by pay type", () => {
    expect(dentistMonth(lines, pay("commission"), ...OCT)).toMatchObject({
      collected: "200000",
      lab: "60000",
      base: "140000",
      commission: "42000",
      salary: "0",
      total: "42000",
    })
    expect(dentistMonth(lines, pay("both"), ...OCT)).toMatchObject({
      commission: "42000",
      total: "792000",
    })
    expect(dentistMonth(lines, pay("salary"), ...OCT)).toMatchObject({
      commission: "0",
      total: "750000",
    })
  })

  it("without pay set: shows the base, earns nothing yet", () => {
    expect(dentistMonth(lines, null, ...OCT)).toMatchObject({
      base: "140000",
      commission: "0",
      total: "0",
    })
    expect(dentistMonth(lines, null, ...NOV).lines).toEqual([])
  })
})

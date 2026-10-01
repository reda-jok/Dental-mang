import { describe, expect, it } from "vitest"

import { agePatientDebts, ageBucket, bucketTotals, daysBetween } from "./debts"

const today = "2026-10-01"

describe("ageBucket", () => {
  it("groups by days past the due date", () => {
    expect(ageBucket("2026-10-01", today)).toBe("current") // due today: not late yet
    expect(ageBucket("2026-10-20", today)).toBe("current")
    expect(ageBucket("2026-09-30", today)).toBe("d1_30")
    expect(ageBucket("2026-09-01", today)).toBe("d1_30") // 30 days
    expect(ageBucket("2026-08-31", today)).toBe("d31_60") // 31 days
    expect(ageBucket("2026-08-02", today)).toBe("d31_60") // 60 days
    expect(ageBucket("2026-08-01", today)).toBe("d61_90")
    expect(ageBucket("2026-07-03", today)).toBe("d61_90") // 90 days
    expect(ageBucket("2026-07-02", today)).toBe("d90plus")
  })

  it("counts days across months and years", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1)
    expect(daysBetween("2026-02-01", "2026-03-01")).toBe(28)
  })
})

describe("agePatientDebts", () => {
  const debts = agePatientDebts(
    [
      { patientId: "a", dueDate: "2026-09-20", balance: "25000" }, // 11 days late
      { patientId: "a", dueDate: "2026-06-01", balance: "100000" }, // 122 days late
      { patientId: "a", dueDate: "2026-10-15", balance: "50000" }, // not due yet
      { patientId: "b", dueDate: "2026-10-30", balance: "40000" },
    ],
    today,
  )

  it("sums each patient's invoices into age groups", () => {
    const a = debts.find((d) => d.patientId === "a")!
    expect(a).toMatchObject({
      owed: "175000",
      overdue: "125000",
      oldestDue: "2026-06-01",
      daysLate: 122,
      worst: "d90plus",
    })
    expect(a.buckets).toEqual({
      current: "50000",
      d1_30: "25000",
      d31_60: "0",
      d61_90: "0",
      d90plus: "100000",
    })
  })

  it("keeps patients who owe but aren't late, with nothing overdue", () => {
    expect(debts.find((d) => d.patientId === "b")).toMatchObject({
      owed: "40000",
      overdue: "0",
      oldestDue: null,
      daysLate: 0,
      worst: "current",
    })
  })

  it("totals each age group across patients", () => {
    expect(bucketTotals(debts)).toEqual({
      current: { amount: "90000", patients: 2 },
      d1_30: { amount: "25000", patients: 1 },
      d31_60: { amount: "0", patients: 0 },
      d61_90: { amount: "0", patients: 0 },
      d90plus: { amount: "100000", patients: 1 },
    })
  })
})

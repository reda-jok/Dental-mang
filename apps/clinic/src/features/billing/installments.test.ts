import { describe, expect, it } from "vitest"

import {
  monthlyInstallments,
  nextDue,
  overdueAmount,
  singleDue,
  unpaidInstallments,
} from "./installments"

const sum = (rows: { amount: string }[]) => rows.reduce((s, r) => s + BigInt(r.amount), 0n)

describe("monthlyInstallments", () => {
  it("takes a deposit on the issue day, then pays monthly in whole thousands", () => {
    const rows = monthlyInstallments({
      total: "1000000",
      months: 6,
      depositPercent: 30,
      issueDate: "2026-10-13",
      firstDue: "2026-11-13",
    })
    expect(rows).toEqual([
      { dueDate: "2026-10-13", amount: "300000", deposit: true },
      { dueDate: "2026-11-13", amount: "116000", deposit: false },
      { dueDate: "2026-12-13", amount: "116000", deposit: false },
      { dueDate: "2027-01-13", amount: "116000", deposit: false },
      { dueDate: "2027-02-13", amount: "116000", deposit: false },
      { dueDate: "2027-03-13", amount: "116000", deposit: false },
      { dueDate: "2027-04-13", amount: "120000", deposit: false },
    ])
    expect(sum(rows)).toBe(1000000n)
  })

  it("has no deposit row at 0%, and keeps month ends", () => {
    const rows = monthlyInstallments({
      total: "300000",
      months: 3,
      depositPercent: 0,
      issueDate: "2026-01-31",
      firstDue: "2026-01-31",
    })
    expect(rows.map((r) => r.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"])
    expect(rows.every((r) => !r.deposit)).toBe(true)
    expect(sum(rows)).toBe(300000n)
  })

  it("never asks for a zero installment", () => {
    const rows = monthlyInstallments({
      total: "5",
      months: 12,
      depositPercent: 0,
      issueDate: "2026-10-13",
      firstDue: "2026-11-13",
    })
    expect(rows.every((r) => BigInt(r.amount) > 0n)).toBe(true)
    expect(sum(rows)).toBe(5n)
  })
})

describe("paying installments", () => {
  const rows = [
    { dueDate: "2026-10-13", amount: "300000" },
    { dueDate: "2026-11-13", amount: "350000" },
    { dueDate: "2026-12-13", amount: "350000" },
  ]

  it("covers the earliest installments first", () => {
    expect(unpaidInstallments(rows, "400000").map((r) => r.unpaid)).toEqual([
      "0",
      "250000",
      "350000",
    ])
    expect(nextDue(rows, "400000")).toMatchObject({ dueDate: "2026-11-13", unpaid: "250000" })
    expect(nextDue(rows, "1000000")).toBeNull()
  })

  it("is late only by what was due before today and isn't paid", () => {
    expect(overdueAmount(rows, "300000", "2026-11-13")).toBe("0") // due today isn't late
    expect(overdueAmount(rows, "300000", "2026-11-14")).toBe("350000")
    expect(overdueAmount(rows, "500000", "2026-11-14")).toBe("150000")
    expect(overdueAmount(rows, "900000", "2026-11-14")).toBe("0") // paid ahead
    expect(overdueAmount(singleDue("50000", "2026-10-31"), "0", "2026-11-01")).toBe("50000")
  })
})

import { describe, expect, it } from "vitest"

import { postingProblem } from "../ledger/rules"
import {
  labAdjustmentPosting,
  labBillPosting,
  labPaymentPosting,
  labStatement,
  monthRange,
  owedFrom,
} from "./money"

describe("lab postings", () => {
  it("books a bill as lab expense owed to the lab, and a payment out of cash or wallet", () => {
    expect(labBillPosting("75000")).toEqual([
      { account: "labExpense", debit: "75000" },
      { account: "payable", credit: "75000" },
    ])
    expect(labPaymentPosting("cash", "50000")).toEqual([
      { account: "payable", debit: "50000" },
      { account: "cash", credit: "50000" },
    ])
    expect(labPaymentPosting("wallet", "50000")[1]).toEqual({ account: "wallet", credit: "50000" })
  })

  it("books a discount against the lab expense and an extra charge on top of it", () => {
    expect(labAdjustmentPosting("discount", "5000")).toEqual([
      { account: "payable", debit: "5000" },
      { account: "labExpense", credit: "5000" },
    ])
    expect(labAdjustmentPosting("charge", "5000")).toEqual([
      { account: "labExpense", debit: "5000" },
      { account: "payable", credit: "5000" },
    ])
  })

  it("always balances", () => {
    for (const lines of [
      labBillPosting("1"),
      labPaymentPosting("cash", "1"),
      labAdjustmentPosting("discount", "1"),
      labAdjustmentPosting("charge", "1"),
    ]) {
      expect(postingProblem(lines)).toBeNull()
    }
  })
})

describe("labStatement", () => {
  it("carries the balance forward line by line and ignores voided payments", () => {
    const statement = labStatement("40000", [
      { kind: "bill", date: "2026-09-03", amount: "75000" },
      { kind: "payment", date: "2026-09-05", amount: "40000" },
      { kind: "payment", date: "2026-09-06", amount: "30000", voided: true },
      { kind: "bill", date: "2026-09-12", amount: "45000" },
      { kind: "discount", date: "2026-09-30", amount: "5000" },
      { kind: "charge", date: "2026-09-30", amount: "10000" },
    ])
    expect(statement.rows.map((r) => r.balance)).toEqual([
      "115000",
      "75000",
      "75000",
      "120000",
      "115000",
      "125000",
    ])
    expect(statement.totals).toEqual({
      billed: "120000",
      charged: "10000",
      paid: "40000",
      discounted: "5000",
    })
    expect(statement.closing).toBe("125000")
    expect(owedFrom(statement.totals)).toBe("85000") // this month's change: 125000 − 40000
  })

  it("shows credit with the lab as a negative balance", () => {
    const statement = labStatement("0", [{ kind: "payment", date: "2026-09-01", amount: "20000" }])
    expect(statement.closing).toBe("-20000")
  })
})

describe("monthRange", () => {
  it("handles the turn of the year", () => {
    expect(monthRange("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
      prev: "2026-11",
      next: "2027-01",
    })
    expect(monthRange("2026-01").prev).toBe("2025-12")
  })
})

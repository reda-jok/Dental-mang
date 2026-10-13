import { describe, expect, it } from "vitest"

import { postingProblem } from "../ledger/rules"
import { expensePosting, expenseTotals } from "./expenses"

describe("expensePosting", () => {
  it("books the expense to its category and takes the money from where it was paid", () => {
    const lines = expensePosting("rent", "bank", "750000")
    expect(lines).toEqual([
      { account: "rent", debit: "750000", memo: undefined },
      { account: "bank", credit: "750000", memo: undefined },
    ])
    expect(postingProblem(lines)).toBeNull()
    expect(expensePosting("utilities", "cash", "25000")[1]).toMatchObject({ account: "cash" })
  })
})

describe("expenseTotals", () => {
  it("adds what counts, by category and from the drawer; voided expenses don't count", () => {
    const totals = expenseTotals([
      { category: "rent", method: "bank", amount: "750000", voided: false },
      { category: "utilities", method: "cash", amount: "25000", voided: false },
      { category: "utilities", method: "cash", amount: "20000.50", voided: false },
      { category: "supplies", method: "cash", amount: "90000", voided: true },
    ])
    expect(totals.total).toBe("795000.50")
    expect(totals.cash).toBe("45000.50")
    expect(totals.byCategory).toEqual([
      { category: "rent", amount: "750000" },
      { category: "utilities", amount: "45000.50" },
    ])
  })
})

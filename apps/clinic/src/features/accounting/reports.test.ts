import { describe, expect, it } from "vitest"

import { cashBook, profitAndLoss, withShares, type LedgerMonthRow } from "./reports"

const row = (
  month: string,
  code: string,
  type: LedgerMonthRow["type"],
  debit: string,
  credit: string,
  name = code,
): LedgerMonthRow => ({ month, code, name, type, debit, credit })

describe("profitAndLoss", () => {
  const months = ["2026-09", "2026-10"]

  it("takes billed treatments less discounts, less costs and the calculated dentist pay", () => {
    const pnl = profitAndLoss(
      months,
      [
        row("2026-09", "4000", "revenue", "0", "1000000"),
        // October: an invoice of 2,000,000 issued and one of 300,000 voided (reversed).
        row("2026-10", "4000", "revenue", "300000", "2000000"),
        row("2026-10", "4100", "revenue", "150000", "0"),
        row("2026-10", "5400", "expense", "750000", "0", "الإيجار"),
        row("2026-10", "5000", "expense", "200000", "50000", "مصاريف المختبر"),
        // Handed to dentists: left out, the calculated pay counts instead.
        row("2026-10", "5200", "expense", "400000", "0"),
        // A drawer overage is a negative cost.
        row("2026-10", "5800", "expense", "0", "5000", "عجز وزيادة الصندوق"),
      ],
      new Map([["2026-10", "320000"]]),
      [{ month: "2026-10", debit: "1200000", credit: "100000" }],
    )
    expect(pnl.revenue).toEqual(["1000000", "1700000"])
    expect(pnl.discounts).toEqual(["0", "150000"])
    expect(pnl.netRevenue).toEqual(["1000000", "1550000"])
    expect(pnl.costs.map((c) => [c.key, c.amounts[1]])).toEqual([
      ["5400", "750000"],
      ["dentistPay", "320000"],
      ["5000", "150000"],
      ["5800", "-5000"],
    ])
    expect(pnl.totalCosts).toEqual(["0", "1215000"])
    expect(pnl.profit).toEqual(["1000000", "335000"])
    expect(pnl.collected).toEqual(["0", "1100000"])
  })

  it("leaves out months outside the run and costs that are zero throughout", () => {
    const pnl = profitAndLoss(
      months,
      [
        row("2026-08", "4000", "revenue", "0", "999"),
        row("2026-10", "5600", "expense", "10000", "10000"),
      ],
      new Map(),
      [],
    )
    expect(pnl.revenue).toEqual(["0", "0"])
    expect(pnl.costs).toEqual([])
    expect(pnl.profit).toEqual(["0", "0"])
  })
})

describe("cashBook", () => {
  it("carries the balance forward through each movement", () => {
    const book = cashBook({ debit: "500000", credit: "100000" }, [
      { id: "a", debit: "250000", credit: "0" },
      { id: "b", debit: "0", credit: "25000.50" },
      { id: "c", debit: "0", credit: "700000" },
    ])
    expect(book.opening).toBe("400000")
    expect(book.rows.map((r) => [r.id, r.balance])).toEqual([
      ["a", "650000"],
      ["b", "624999.50"],
      ["c", "-75000.50"],
    ])
    expect(book).toMatchObject({ moneyIn: "250000", moneyOut: "725000.50", closing: "-75000.50" })
  })
})

describe("withShares", () => {
  it("sorts biggest first, drops zero and negative rows, and sizes against the biggest", () => {
    const rows = withShares([
      { key: "a", amount: "100000" },
      { key: "b", amount: "300000" },
      { key: "c", amount: "0" },
      { key: "d", amount: "-50000" },
    ])
    expect(rows.map((r) => [r.key, r.percent, r.bar])).toEqual([
      ["b", 75, 1],
      ["a", 25, 0.333],
    ])
    expect(withShares([])).toEqual([])
  })
})

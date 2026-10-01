import { describe, expect, it } from "vitest"

import { postingProblem, reversalLines, type PostingLine } from "./rules"

const sale: PostingLine[] = [
  { account: "receivable", debit: "225000" },
  { account: "discounts", debit: "25000" },
  { account: "revenue", credit: "250000" },
]

describe("postingProblem", () => {
  it("accepts a balanced entry", () => {
    expect(postingProblem(sale)).toBeNull()
    expect(
      postingProblem([
        { account: "cash", debit: "0.10" },
        { account: "cash", debit: "0.20" },
        { account: "receivable", credit: "0.30" },
      ]),
    ).toBeNull() // exact minor units: no 0.1 + 0.2 drift
  })

  it("rejects debits that don't equal credits", () => {
    expect(
      postingProblem([
        { account: "cash", debit: "250000" },
        { account: "receivable", credit: "200000" },
      ]),
    ).toBe("unbalanced")
  })

  it("rejects one-line entries", () => {
    expect(postingProblem([{ account: "cash", debit: "1000" }])).toBe("tooFewLines")
    expect(postingProblem([])).toBe("tooFewLines")
  })

  it("rejects lines with both sides, neither side, or a bad amount", () => {
    const credit: PostingLine = { account: "revenue", credit: "1000" }
    expect(postingProblem([{ account: "cash", debit: "1000", credit: "1000" }, credit])).toBe(
      "invalidLine",
    )
    expect(postingProblem([{ account: "cash" }, credit])).toBe("invalidLine")
    expect(postingProblem([{ account: "cash", debit: "-1000" }, credit])).toBe("invalidLine")
    expect(postingProblem([{ account: "cash", debit: "1,000" }, credit])).toBe("invalidLine")
  })
})

describe("reversalLines", () => {
  it("swaps debits and credits and still balances", () => {
    const reversed = reversalLines(sale)
    expect(reversed).toEqual([
      { account: "receivable", credit: "225000", debit: undefined },
      { account: "discounts", credit: "25000", debit: undefined },
      { account: "revenue", debit: "250000", credit: undefined },
    ])
    expect(postingProblem(reversed)).toBeNull()
  })
})

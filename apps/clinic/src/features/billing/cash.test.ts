import { describe, expect, it } from "vitest"

import { postingProblem } from "../ledger/rules"
import { closeOutcome, differencePosting, signedAmount, summarize } from "./cash"

describe("summarize", () => {
  it("expects cash in minus cash out; card and wallet are listed, not counted", () => {
    const summary = summarize([
      { kind: "payment", method: "cash", amount: "50000" },
      { kind: "payment", method: "cash", amount: "25000" },
      { kind: "refund", method: "cash", amount: "10000" },
      { kind: "payment_void", method: "cash", amount: "5000" },
      { kind: "payment", method: "card", amount: "175000" },
      { kind: "payment", method: "wallet", amount: "40000" },
      { kind: "refund", method: "wallet", amount: "15000" },
    ])
    expect(summary).toEqual({
      cashIn: "75000",
      cashOut: "15000",
      expected: "60000",
      card: "175000",
      wallet: "40000",
      counts: { cashIn: 2, cashOut: 2, card: 1, wallet: 1 },
    })
  })

  it("is zero for a day without money", () => {
    expect(summarize([])).toMatchObject({ cashIn: "0", cashOut: "0", expected: "0" })
  })

  it("can expect a negative amount when more cash went out than came in", () => {
    expect(summarize([{ kind: "refund", method: "cash", amount: "20000" }]).expected).toBe("-20000")
  })

  it("stores received as positive and the rest as negative", () => {
    expect(signedAmount({ kind: "payment", method: "cash", amount: "100" })).toBe("100")
    expect(signedAmount({ kind: "refund", method: "cash", amount: "100" })).toBe("-100")
    expect(signedAmount({ kind: "payment_void", method: "card", amount: "100" })).toBe("-100")
  })
})

describe("closeOutcome", () => {
  it("compares the count with what's expected", () => {
    expect(closeOutcome("60000", "60000")).toEqual({ difference: "0", kind: "match" })
    expect(closeOutcome("65000", "60000")).toEqual({ difference: "5000", kind: "over" })
    expect(closeOutcome("58000", "60000")).toEqual({ difference: "-2000", kind: "short" })
  })
})

describe("differencePosting", () => {
  it("books a shortage as an expense and an overage as income, balanced", () => {
    const short = differencePosting("-2000")!
    expect(short).toEqual([
      { account: "cashOverShort", debit: "2000" },
      { account: "cash", credit: "2000" },
    ])
    expect(postingProblem(short)).toBeNull()
    const over = differencePosting("5000")!
    expect(over).toEqual([
      { account: "cash", debit: "5000" },
      { account: "cashOverShort", credit: "5000" },
    ])
    expect(postingProblem(over)).toBeNull()
  })

  it("posts nothing when the drawer matches", () => {
    expect(differencePosting("0")).toBeNull()
  })
})

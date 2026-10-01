import { describe, expect, it } from "vitest"

import { postingProblem } from "../ledger/rules"
import {
  allocate,
  documentNumber,
  patientAccount,
  paymentPosting,
  refundPosting,
  sumAmounts,
  unappliedMoney,
} from "./payments"

describe("postings", () => {
  it("records money in and out against patient receivables, balanced", () => {
    const received = paymentPosting("wallet", "75000")
    expect(received).toEqual([
      { account: "wallet", debit: "75000" },
      { account: "receivable", credit: "75000" },
    ])
    expect(postingProblem(received)).toBeNull()
    const refunded = refundPosting("cash", "10000")
    expect(refunded).toEqual([
      { account: "receivable", debit: "10000" },
      { account: "cash", credit: "10000" },
    ])
    expect(postingProblem(refunded)).toBeNull()
  })
})

describe("unappliedMoney", () => {
  it("is what each payment has left, oldest first", () => {
    expect(
      unappliedMoney(
        [
          { id: "p1", amount: "50000", applied: "50000" },
          { id: "p2", amount: "30000", applied: "10000" },
        ],
        "0",
      ),
    ).toEqual([{ paymentId: "p2", amount: 2000000n }])
  })

  it("pays refunds out of the newest money", () => {
    expect(
      unappliedMoney(
        [
          { id: "p1", amount: "20000", applied: "0" },
          { id: "p2", amount: "30000", applied: "0" },
        ],
        "35000",
      ),
    ).toEqual([{ paymentId: "p1", amount: 1500000n }])
  })
})

describe("allocate", () => {
  const money = [
    { paymentId: "p1", amount: 3000000n }, // 30,000
    { paymentId: "p2", amount: 5000000n }, // 50,000
  ]
  const invoices = [
    { id: "old", balance: "40000" },
    { id: "new", balance: "25000" },
  ]

  it("pays the oldest invoice first, with the oldest money", () => {
    expect(allocate(money, invoices)).toEqual([
      { paymentId: "p1", invoiceId: "old", amount: "30000" },
      { paymentId: "p2", invoiceId: "old", amount: "10000" },
      { paymentId: "p2", invoiceId: "new", amount: "25000" },
    ])
  })

  it("pays the chosen invoice first", () => {
    expect(allocate(money, invoices, "new")).toEqual([
      { paymentId: "p1", invoiceId: "new", amount: "25000" },
      { paymentId: "p1", invoiceId: "old", amount: "5000" },
      { paymentId: "p2", invoiceId: "old", amount: "35000" },
    ])
  })

  it("leaves extra money unapplied (patient credit)", () => {
    const result = allocate(
      [{ paymentId: "p1", amount: 10000000n }],
      [{ id: "a", balance: "40000" }],
    )
    expect(result).toEqual([{ paymentId: "p1", invoiceId: "a", amount: "40000" }])
  })

  it("does nothing without money or open invoices", () => {
    expect(allocate([], invoices)).toEqual([])
    expect(allocate(money, [])).toEqual([])
  })
})

describe("patientAccount", () => {
  it("owes what's invoiced minus what's paid", () => {
    expect(patientAccount({ invoiced: "100000", received: "60000", refunded: "0" })).toEqual({
      invoiced: "100000",
      paid: "60000",
      balance: "40000",
      owes: true,
      credit: "0",
    })
  })

  it("shows overpayment (a deposit) as credit, and refunds reduce it", () => {
    expect(patientAccount({ invoiced: "0", received: "50000", refunded: "20000" })).toEqual({
      invoiced: "0",
      paid: "30000",
      balance: "-30000",
      owes: false,
      credit: "30000",
    })
  })
})

describe("helpers", () => {
  it("sums exactly and numbers documents", () => {
    expect(sumAmounts(["0.10", "0.20", "1000"])).toBe("1000.30")
    expect(documentNumber("RC", "2026-10-01", 7)).toBe("RC-2026-000007")
  })
})

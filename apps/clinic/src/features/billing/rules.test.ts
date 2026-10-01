import { describe, expect, it } from "vitest"

import { postingProblem } from "../ledger/rules"
import {
  givesNewDiscount,
  invoiceNumber,
  invoicePosting,
  invoiceTotals,
  paymentState,
} from "./rules"

const filling = { quantity: 1, unitPrice: "25000", discount: "0" }
const xrays = { quantity: 2, unitPrice: "10000", discount: "5000" }

describe("invoiceTotals", () => {
  it("adds lines, line discounts and a discount on the whole invoice", () => {
    const result = invoiceTotals([filling, xrays], "1000")
    expect(result).toEqual({
      ok: true,
      totals: {
        subtotal: "45000",
        discountTotal: "6000",
        extraDiscount: "1000",
        total: "39000",
        lines: [
          { gross: "25000", discount: "0", total: "25000" },
          { gross: "20000", discount: "5000", total: "15000" },
        ],
      },
    })
  })

  it("allows a fully discounted invoice", () => {
    const result = invoiceTotals([{ ...filling, discount: "25000" }])
    expect(result.ok && result.totals.total).toBe("0")
  })

  it("refuses discounts bigger than what they discount", () => {
    expect(invoiceTotals([filling, { ...xrays, discount: "20001" }])).toEqual({
      ok: false,
      error: "lineDiscountTooLarge",
      line: 1,
    })
    expect(invoiceTotals([filling], "25001")).toEqual({
      ok: false,
      error: "extraDiscountTooLarge",
    })
  })

  it("refuses an empty or zero-value invoice", () => {
    expect(invoiceTotals([])).toEqual({ ok: false, error: "emptyInvoice" })
    expect(invoiceTotals([{ ...filling, unitPrice: "0" }])).toEqual({
      ok: false,
      error: "emptyInvoice",
    })
  })
})

describe("givesNewDiscount", () => {
  it("is false when nothing new is discounted", () => {
    expect(givesNewDiscount([{ discount: "0" }], "0")).toBe(false)
    // A discount already agreed on the treatment plan carries over freely.
    expect(givesNewDiscount([{ discount: "5000", agreedDiscount: "5000" }], "0")).toBe(false)
  })

  it("is true for a bigger line discount or any invoice discount", () => {
    expect(givesNewDiscount([{ discount: "6000", agreedDiscount: "5000" }], "0")).toBe(true)
    expect(givesNewDiscount([{ discount: "1" }], "0")).toBe(true)
    expect(givesNewDiscount([{ discount: "0" }], "1000")).toBe(true)
  })
})

describe("invoicePosting", () => {
  it("books revenue gross and discounts separately, balanced", () => {
    const lines = invoicePosting({ subtotal: "45000", discountTotal: "6000", total: "39000" })
    expect(lines).toEqual([
      { account: "receivable", debit: "39000" },
      { account: "discounts", debit: "6000" },
      { account: "revenue", credit: "45000" },
    ])
    expect(postingProblem(lines)).toBeNull()
  })

  it("skips empty sides", () => {
    expect(invoicePosting({ subtotal: "25000", discountTotal: "0", total: "25000" })).toEqual([
      { account: "receivable", debit: "25000" },
      { account: "revenue", credit: "25000" },
    ])
    const free = invoicePosting({ subtotal: "25000", discountTotal: "25000", total: "0" })
    expect(free).toEqual([
      { account: "discounts", debit: "25000" },
      { account: "revenue", credit: "25000" },
    ])
    expect(postingProblem(free)).toBeNull()
  })
})

describe("paymentState", () => {
  const base = {
    status: "issued" as const,
    total: "50000",
    paid: "0",
    dueDate: "2026-10-31",
    today: "2026-10-01",
  }
  it("derives the state from payments and the due date", () => {
    expect(paymentState(base)).toBe("unpaid")
    expect(paymentState({ ...base, paid: "20000" })).toBe("partial")
    expect(paymentState({ ...base, paid: "50000" })).toBe("paid")
    expect(paymentState({ ...base, today: "2026-11-01" })).toBe("overdue")
    expect(paymentState({ ...base, paid: "20000", today: "2026-11-01" })).toBe("overdue")
    expect(paymentState({ ...base, status: "void" })).toBe("void")
  })

  it("treats a zero invoice as paid", () => {
    expect(paymentState({ ...base, total: "0" })).toBe("paid")
  })

  it("is not overdue on the due date itself", () => {
    expect(paymentState({ ...base, today: "2026-10-31" })).toBe("unpaid")
  })
})

describe("invoiceNumber", () => {
  it("uses the issue year and a zero-padded sequence", () => {
    expect(invoiceNumber("2026-10-01", 123n)).toBe("INV-2026-000123")
  })
})

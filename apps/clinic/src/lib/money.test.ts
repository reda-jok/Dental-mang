import { describe, expect, it } from "vitest"

import {
  amountField,
  formatMoney,
  parseAmount,
  subtractAmounts,
  sumByCurrency,
  toMinor,
} from "./money"

describe("parseAmount", () => {
  it("accepts how people type prices", () => {
    expect(parseAmount("250000", "IQD")).toBe("250000")
    expect(parseAmount("250,000", "IQD")).toBe("250000")
    expect(parseAmount(" 250 000 ", "IQD")).toBe("250000")
    expect(parseAmount("٢٥٠٬٠٠٠", "IQD")).toBe("250000")
    expect(parseAmount("0", "IQD")).toBe("0")
    expect(parseAmount("007", "IQD")).toBe("7")
    expect(parseAmount("120.5", "USD")).toBe("120.50")
    expect(parseAmount("120.00", "USD")).toBe("120")
  })

  it("rejects fractions of a dinar, negatives and garbage", () => {
    expect(parseAmount("1000.5", "IQD")).toBeNull()
    expect(parseAmount("-5", "IQD")).toBeNull()
    expect(parseAmount("1e5", "IQD")).toBeNull()
    expect(parseAmount("12.345", "USD")).toBeNull()
    expect(parseAmount("abc", "USD")).toBeNull()
    expect(parseAmount("1".repeat(13), "IQD")).toBeNull()
  })
})

describe("amountField", () => {
  it("reports required and invalid", () => {
    const field = amountField(() => "IQD")
    expect(field.safeParse("").error?.issues[0]?.message).toBe("required")
    expect(field.safeParse("12.5").error?.issues[0]?.message).toBe("invalidAmount")
    expect(field.parse("25,000")).toBe("25000")
  })
})

describe("arithmetic", () => {
  it("adds exactly (no floating-point drift)", () => {
    expect(
      sumByCurrency([
        { amount: "0.10", currency: "USD" },
        { amount: "0.20", currency: "USD" },
      ]),
    ).toEqual([{ currency: "USD", amount: "0.30" }])
  })

  it("keeps currencies apart", () => {
    expect(
      sumByCurrency([
        { amount: "250000", currency: "IQD" },
        { amount: "900", currency: "USD" },
        { amount: "50000", currency: "IQD" },
      ]),
    ).toEqual([
      { currency: "IQD", amount: "300000" },
      { currency: "USD", amount: "900" },
    ])
  })

  it("subtracts discounts", () => {
    expect(subtractAmounts("250000", "25000")).toBe("225000")
    expect(subtractAmounts("100.50", "0.50")).toBe("100")
    expect(toMinor("999999999999.99")).toBe(99999999999999n)
  })
})

describe("formatMoney", () => {
  it("uses Western digits and the right decimals per currency", () => {
    const iqd = formatMoney("250000", "IQD")
    expect(iqd).toContain("250,000")
    expect(iqd).not.toMatch(/[٠-٩]/)
    expect(formatMoney("120.5", "USD")).toContain("120.50")
  })
})

import { describe, expect, it } from "vitest"

import { createProcedureSchema } from "./schemas"

const valid = {
  name: "حشوة تجميلية",
  categoryId: "7d9f5a3e-8c1b-4c2e-9a4f-1b2c3d4e5f60",
  currency: "IQD",
  price: "٢٥,٠٠٠",
  toothScope: "surfaces",
  chartResult: "filling",
  durationMinutes: "30",
  requiresLab: false,
}

describe("createProcedureSchema", () => {
  it("normalizes price and duration", () => {
    expect(createProcedureSchema.parse(valid)).toMatchObject({
      price: "25000",
      durationMinutes: 30,
    })
  })

  it("prices in whole dinars only", () => {
    const iqd = createProcedureSchema.safeParse({ ...valid, price: "25000.5" })
    expect(iqd.error?.issues[0]?.message).toBe("invalidAmount")
    expect(createProcedureSchema.safeParse({ ...valid, currency: "USD" }).success).toBe(false)
  })

  it("allows no chart result and no duration", () => {
    expect(
      createProcedureSchema.parse({ ...valid, chartResult: "", durationMinutes: "" }),
    ).toMatchObject({
      chartResult: null,
      durationMinutes: null,
    })
  })

  it("rejects out-of-range durations and unknown chart results", () => {
    expect(createProcedureSchema.safeParse({ ...valid, durationMinutes: "2" }).success).toBe(false)
    expect(createProcedureSchema.safeParse({ ...valid, chartResult: "gold_star" }).success).toBe(
      false,
    )
  })
})

import { describe, expect, it } from "vitest"

import { searchTokens } from "@/lib/arabic"

import { buildSearchText } from "./search"

const text = buildSearchText({
  fullName: "فاطمة أحمد الجبوري",
  code: "P-000123",
  phone: "+9647701234567",
  phone2: null,
})

/** Mirrors the SQL: every token must appear somewhere in the search text. */
const matches = (query: string) => {
  const tokens = searchTokens(query)
  return tokens.length > 0 && tokens.every((t) => text.includes(t))
}

describe("patient search", () => {
  it("finds names regardless of spelling variants", () => {
    expect(matches("فاطمه")).toBe(true)
    expect(matches("احمد الجبوري")).toBe(true)
    expect(matches("فاطِمَة")).toBe(true)
  })

  it("finds by code in any form", () => {
    expect(matches("P-000123")).toBe(true)
    expect(matches("000123")).toBe(true)
    expect(matches("p000123")).toBe(false) // needs the separator or just the number
  })

  it("finds by phone typed in any common format", () => {
    expect(matches("07701234567")).toBe(true)
    expect(matches("0770 123 4567")).toBe(true)
    expect(matches("+964 770 123 4567")).toBe(true)
    expect(matches("٠٧٧٠١٢٣٤٥٦٧")).toBe(true)
  })

  it("doesn't match other patients", () => {
    expect(matches("زينب")).toBe(false)
    expect(matches("07809999999")).toBe(false)
  })
})

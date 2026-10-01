import { describe, expect, it } from "vitest"

import { normalizeArabic, searchTokens } from "./arabic"

describe("normalizeArabic", () => {
  it("unifies alef forms, taa marbuta and alef maqsura", () => {
    expect(normalizeArabic("أحمد")).toBe(normalizeArabic("احمد"))
    expect(normalizeArabic("إسراء")).toBe(normalizeArabic("اسراء"))
    expect(normalizeArabic("آمنة")).toBe(normalizeArabic("امنه"))
    expect(normalizeArabic("فاطمة")).toBe(normalizeArabic("فاطمه"))
    expect(normalizeArabic("مصطفى")).toBe(normalizeArabic("مصطفي"))
  })

  it("ignores diacritics and tatweel", () => {
    expect(normalizeArabic("مُحَمَّد")).toBe("محمد")
    expect(normalizeArabic("محـــمد")).toBe("محمد")
  })

  it("converts digits and lowercases Latin", () => {
    expect(normalizeArabic("P-٠٠٠١٢٣")).toBe("p 000123")
    expect(normalizeArabic("ALI")).toBe("ali")
  })

  it("turns punctuation into spaces and collapses them", () => {
    expect(normalizeArabic("  علي،  حسن - (الكرادة) ")).toBe("علي حسن الكراده")
  })
})

describe("searchTokens", () => {
  it("splits a query into normalized tokens", () => {
    expect(searchTokens("  أحمد   عليّ ")).toEqual(["احمد", "علي"])
  })

  it("caps the number of tokens", () => {
    expect(searchTokens("a b c d e f g")).toHaveLength(5)
  })

  it("returns nothing for blank or punctuation-only queries", () => {
    expect(searchTokens("   ")).toEqual([])
    expect(searchTokens("--- ,,")).toEqual([])
  })
})

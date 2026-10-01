import { describe, expect, it } from "vitest"

import { directionOf, languageOf, toLocale } from "./config"

describe("locale", () => {
  it("forces Western digits for dates and money", () => {
    const locale = toLocale("ar")
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
      new Date("2026-09-29T00:00:00Z"),
    )
    expect(date).toMatch(/29/)
    expect(date).toMatch(/2026/)
    expect(date).not.toMatch(/[٠-٩]/)
    expect(new Intl.NumberFormat(locale).format(1234567)).toBe("1,234,567")
  })

  it("keeps Arabic plural rules and right-to-left layout", () => {
    expect(new Intl.PluralRules(toLocale("ar")).select(5)).toBe("few")
    expect(directionOf(toLocale("ar"))).toBe("rtl")
    expect(languageOf("ar-u-nu-latn")).toBe("ar")
  })
})

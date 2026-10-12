import { describe, expect, it } from "vitest"

import { themeFor } from "./theme"

describe("themeFor", () => {
  it("is dark only when chosen", () => {
    expect(themeFor("dark", "/dashboard")).toBe("dark")
    expect(themeFor("light", "/dashboard")).toBe("light")
    expect(themeFor(undefined, "/dashboard")).toBe("light")
    expect(themeFor("purple", null)).toBe("light")
  })

  it("keeps printouts light", () => {
    expect(themeFor("dark", "/print/receipt/123")).toBe("light")
  })
})

import { describe, expect, it } from "vitest"

import {
  ALL_TEETH,
  isAnterior,
  isPrimary,
  isUpper,
  isValidTooth,
  mesialOnRight,
  normalizeSurfaces,
  PERMANENT_ROWS,
  PRIMARY_ROWS,
} from "./teeth"

describe("FDI numbering", () => {
  it("has 32 permanent and 20 primary teeth, all valid and unique", () => {
    expect(PERMANENT_ROWS.flat()).toHaveLength(32)
    expect(PRIMARY_ROWS.flat()).toHaveLength(20)
    expect(new Set(ALL_TEETH).size).toBe(52)
    expect(ALL_TEETH.every(isValidTooth)).toBe(true)
  })

  it("rejects numbers that aren't teeth", () => {
    for (const n of [0, 10, 19, 29, 49, 56, 66, 86, 91, 111])
      expect(isValidTooth(n), String(n)).toBe(false)
  })

  it("classifies teeth", () => {
    expect(isPrimary(55)).toBe(true)
    expect(isPrimary(16)).toBe(false)
    expect(isUpper(26)).toBe(true)
    expect(isUpper(36)).toBe(false)
    expect(isUpper(61)).toBe(true)
    expect(isAnterior(13)).toBe(true)
    expect(isAnterior(14)).toBe(false)
  })

  it("puts the mesial side toward the midline", () => {
    // 11 sits just left of the midline on the chart, so its mesial side is on the right.
    expect(mesialOnRight(11)).toBe(true)
    expect(mesialOnRight(21)).toBe(false)
    expect(mesialOnRight(46)).toBe(true)
    expect(mesialOnRight(36)).toBe(false)
  })
})

describe("normalizeSurfaces", () => {
  it("orders and deduplicates", () => {
    expect(normalizeSurfaces(["O", "M", "M", "D"])).toEqual(["M", "D", "O"])
    expect(normalizeSurfaces(["X", "L"])).toEqual(["L"])
  })
})

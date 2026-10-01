import { describe, expect, it } from "vitest"

import {
  ageInYears,
  birthDateFromAge,
  parseIsoDate,
  startOfDayUtc,
  startOfMonthUtc,
  todayIso,
} from "./dates"

describe("parseIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(parseIsoDate("2020-02-29")?.toISOString()).toBe("2020-02-29T00:00:00.000Z")
    expect(parseIsoDate("2021-02-29")).toBeNull()
    expect(parseIsoDate("2021-13-01")).toBeNull()
    expect(parseIsoDate("01/02/2020")).toBeNull()
  })
})

describe("todayIso", () => {
  it("uses the clinic time zone, not UTC", () => {
    // 22:30 UTC on 31 Dec is already 1 Jan in Baghdad (UTC+3).
    expect(todayIso("Asia/Baghdad", new Date("2025-12-31T22:30:00Z"))).toBe("2026-01-01")
  })
})

describe("ageInYears", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageInYears("1990-06-15", "2026-06-14")).toBe(35)
    expect(ageInYears("1990-06-15", "2026-06-15")).toBe(36)
    expect(ageInYears("2026-01-01", "2026-09-29")).toBe(0)
  })
})

describe("birthDateFromAge", () => {
  it("goes back exactly `age` years so the displayed age matches", () => {
    const birth = birthDateFromAge(40, "2026-09-29")
    expect(birth).toBe("1986-09-29")
    expect(ageInYears(birth, "2026-09-29")).toBe(40)
  })

  it("handles 29 February", () => {
    expect(birthDateFromAge(1, "2028-02-29")).toBe("2027-02-28")
  })
})

describe("clinic day/month boundaries", () => {
  it("starts a Baghdad day at 21:00 UTC the evening before", () => {
    expect(startOfDayUtc("2026-10-01", "Asia/Baghdad").toISOString()).toBe(
      "2026-09-30T21:00:00.000Z",
    )
  })

  it("uses the clinic's month, not the server's", () => {
    // 22:30 UTC on 30 Sep is already 1 Oct in Baghdad → October has started.
    const now = new Date("2026-09-30T22:30:00Z")
    expect(startOfMonthUtc("Asia/Baghdad", now).toISOString()).toBe("2026-09-30T21:00:00.000Z")
  })

  it("works for zones behind UTC too", () => {
    expect(startOfDayUtc("2026-01-15", "America/New_York").toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    )
  })
})

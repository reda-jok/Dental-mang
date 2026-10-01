import { describe, expect, it } from "vitest"

import { minutesInZone, zonedInstant } from "@/lib/dates"

import {
  canChangeStatus,
  generateSlots,
  hhmmToMinutes,
  isRestDay,
  minutesToHhmm,
  monthGrid,
  slotAvailability,
  weekOf,
} from "./rules"

describe("time slots", () => {
  it("covers the working day; the last slot ends at closing", () => {
    const slots = generateSlots(15 * 60 + 30, 22 * 60, 30).map(minutesToHhmm)
    expect(slots[0]).toBe("15:30")
    expect(slots.at(-1)).toBe("21:30")
    expect(slots).toHaveLength(13)
  })

  it("parses times strictly", () => {
    expect(hhmmToMinutes("16:30")).toBe(990)
    expect(hhmmToMinutes("24:00")).toBeNull()
    expect(hhmmToMinutes("4:30")).toBeNull()
  })

  it("marks slots that clash with busy time or run past closing", () => {
    const slots = generateSlots(960, 1080, 30) // 16:00–18:00
    const busy = [{ start: 990, end: 1020 }] // 16:30–17:00
    const result = slotAvailability(slots, 60, busy, 1080)
    expect(result.map((s) => [minutesToHhmm(s.start), s.taken])).toEqual([
      ["16:00", true], // 16:00–17:00 overlaps 16:30
      ["16:30", true],
      ["17:00", false], // back-to-back is fine
      ["17:30", true], // would end 18:30, after closing
    ])
  })
})

describe("rest days", () => {
  it("covers weekly days off and one-off holidays", () => {
    const holidays = new Set(["2026-10-07"])
    expect(isRestDay("2026-10-02", holidays, [5])).toBe(true) // Friday
    expect(isRestDay("2026-10-07", holidays, [5])).toBe(true) // holiday
    expect(isRestDay("2026-10-03", holidays, [5])).toBe(false) // Saturday
  })
})

describe("status changes", () => {
  it("follows the visit: pending → in progress → completed", () => {
    expect(canChangeStatus("pending", "in_progress")).toBe(true)
    expect(canChangeStatus("in_progress", "completed")).toBe(true)
    expect(canChangeStatus("pending", "completed")).toBe(false) // start the visit first
  })

  it("completed, cancelled and no-show are final", () => {
    for (const from of ["completed", "cancelled", "no_show"] as const) {
      expect(canChangeStatus(from, "pending"), from).toBe(false)
    }
    expect(canChangeStatus("pending", "no_show")).toBe(true)
  })
})

describe("calendar", () => {
  it("weeks run Saturday → Friday", () => {
    const week = weekOf("2026-10-01") // a Thursday
    expect(week[0]).toBe("2026-09-26") // Saturday
    expect(week[6]).toBe("2026-10-02") // Friday
  })

  it("month grid is 42 days starting on the Saturday before the 1st", () => {
    const grid = monthGrid("2026-10-15")
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe("2026-09-26")
    expect(grid).toContain("2026-10-31")
  })
})

describe("clinic-local times", () => {
  it("round-trips a Baghdad appointment time", () => {
    const at = zonedInstant("2026-10-05", 16 * 60 + 30, "Asia/Baghdad")
    expect(at.toISOString()).toBe("2026-10-05T13:30:00.000Z")
    expect(minutesInZone(at, "Asia/Baghdad")).toBe(990)
  })
})

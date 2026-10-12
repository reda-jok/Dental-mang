import { describe, expect, it } from "vitest"

import { minutesInZone, zonedInstant } from "@/lib/dates"

import {
  availabilityFor,
  canChangeStatus,
  finishProblem,
  generateSlots,
  hhmmToMinutes,
  isRestDay,
  minutesToHhmm,
  monthGrid,
  nextVisitItems,
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

describe("availabilityFor", () => {
  const slots = generateSlots(960, 1080, 30) // 16:00-18:00
  const at = (start: number, dentistId: string | null, roomId: string | null = null) => ({
    start,
    end: start + 30,
    dentistId,
    roomId,
  })
  const takenTimes = (r: { start: number; taken: boolean }[]) =>
    r.filter((s) => s.taken).map((s) => minutesToHhmm(s.start))
  const two = { dentistIds: ["a", "b"], roomIds: [] }
  const none = { dentistId: null, roomId: null }

  it("with no dentist chosen a time is free while any dentist is free", () => {
    const day = [at(960, "a"), at(990, "a"), at(990, "b")]
    expect(takenTimes(availabilityFor(slots, 30, day, none, two, 1080))).toEqual(["16:30"])
  })

  it("a chosen dentist only sees their own bookings", () => {
    const day = [at(960, "a"), at(990, "b")]
    const chosen = { dentistId: "a", roomId: null }
    expect(takenTimes(availabilityFor(slots, 30, day, chosen, two, 1080))).toEqual(["16:00"])
  })

  it("bookings with no dentist or room block only unassigned bookings", () => {
    const day = [at(960, null)]
    expect(takenTimes(availabilityFor(slots, 30, day, none, two, 1080))).toEqual(["16:00"])
    const chosen = { dentistId: "a", roomId: null }
    expect(takenTimes(availabilityFor(slots, 30, day, chosen, two, 1080))).toEqual([])
  })

  it("a clinic with no dentists or rooms is one chair: any booking blocks", () => {
    const day = [at(960, null), at(990, "x")]
    const result = availabilityFor(slots, 30, day, none, { dentistIds: [], roomIds: [] }, 1080)
    expect(takenTimes(result)).toEqual(["16:00", "16:30"])
  })

  it("a longer booking is taken when every dentist is busy during it, or it runs past closing", () => {
    const day = [at(990, "a"), at(990, "b")]
    // 17:30 is taken only because 17:30-18:30 runs past closing
    expect(takenTimes(availabilityFor(slots, 60, day, none, two, 1080))).toEqual([
      "16:00",
      "16:30",
      "17:30",
    ])
  })
})

describe("the next visit's treatments", () => {
  const item = (id: string, planId: string, phase: number, bookedAhead = false) => ({
    id,
    planId,
    phase,
    bookedAhead,
  })

  it("ticks the earliest unfinished phase of the first plan", () => {
    const items = [item("a", "p1", 2), item("b", "p1", 2), item("c", "p1", 3), item("d", "p2", 1)]
    expect(nextVisitItems(items)).toEqual(["a", "b"])
    expect(nextVisitItems(items, "p2")).toEqual(["d"])
  })

  it("leaves out treatments already booked on a later visit", () => {
    expect(nextVisitItems([item("a", "p1", 1, true), item("b", "p1", 2)])).toEqual(["b"])
    expect(nextVisitItems([item("a", "p1", 1, true)])).toEqual([])
    expect(nextVisitItems([])).toEqual([])
  })
})

describe("finishing a visit", () => {
  const base = { open: ["a", "b"], outcomes: {}, doneToday: 0, noTreatment: false }

  it("needs an outcome for every open treatment booked for the visit", () => {
    expect(finishProblem({ ...base, outcomes: { a: "done" } })).toBe("outcomeRequired")
    expect(finishProblem({ ...base, outcomes: { a: "done", b: "not_done" } })).toBeNull()
  })

  it("refuses a visit where nothing was done, unless it was only a check-up", () => {
    const nothing = { ...base, outcomes: { a: "not_done", b: "not_done" } } as const
    expect(finishProblem(nothing)).toBe("nothingRecorded")
    expect(finishProblem({ ...nothing, noTreatment: true })).toBeNull()
    expect(finishProblem({ ...base, open: [] })).toBe("nothingRecorded")
  })

  it("counts work in progress and treatments already marked done today", () => {
    expect(finishProblem({ ...base, outcomes: { a: "continued", b: "not_done" } })).toBeNull()
    expect(finishProblem({ ...base, open: [], doneToday: 1 })).toBeNull()
  })
})

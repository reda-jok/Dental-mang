import { describe, expect, it } from "vitest"

import { nextOpenDay, reminderState, summarize } from "./rules"

describe("reminderState", () => {
  it("sent once logged, otherwise to do, or no phone to send to", () => {
    expect(reminderState({ phone: "+9647701234567", sentCount: 0 })).toBe("todo")
    expect(reminderState({ phone: "+9647701234567", sentCount: 2 })).toBe("sent")
    expect(reminderState({ phone: null, sentCount: 0 })).toBe("noPhone")
  })

  it("counts each state", () => {
    const rows = (["sent", "todo", "todo", "noPhone"] as const).map((state) => ({ state }))
    expect(summarize(rows)).toEqual({ total: 4, sent: 1, todo: 2, noPhone: 1 })
  })
})

describe("nextOpenDay", () => {
  const friday = [5]
  it("is tomorrow on an ordinary day", () => {
    expect(nextOpenDay("2026-10-11", new Set(), friday)).toBe("2026-10-12") // Sunday → Monday
  })

  it("skips the weekly day off and rest days", () => {
    expect(nextOpenDay("2026-10-15", new Set(), friday)).toBe("2026-10-17") // Thursday → Saturday
    expect(nextOpenDay("2026-10-15", new Set(["2026-10-17"]), friday)).toBe("2026-10-18")
  })
})

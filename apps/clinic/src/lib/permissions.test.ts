import { describe, expect, it } from "vitest"

import { hasPermission, ROLE_NAMES } from "./permissions"

describe("hasPermission", () => {
  it("gives the owner every permission", () => {
    expect(hasPermission("owner", "accounting:write")).toBe(true)
    expect(hasPermission("owner", "settings:write")).toBe(true)
    expect(hasPermission("owner", "billing:void")).toBe(true)
  })

  it("keeps clinical records away from reception and accountants", () => {
    expect(hasPermission("reception", "clinical:read")).toBe(false)
    expect(hasPermission("accountant", "clinical:read")).toBe(false)
    expect(hasPermission("dentist", "clinical:write")).toBe(true)
  })

  it("lets only owner/admin change settings", () => {
    const allowed = ROLE_NAMES.filter((role) => hasPermission(role, "settings:write"))
    expect(allowed.sort()).toEqual(["admin", "owner"])
  })

  it("does not let reception void invoices", () => {
    expect(hasPermission("reception", "billing:write")).toBe(true)
    expect(hasPermission("reception", "billing:void")).toBe(false)
  })

  it("denies unknown or missing roles", () => {
    expect(hasPermission("hacker", "patient:read")).toBe(false)
    expect(hasPermission(null, "patient:read")).toBe(false)
    expect(hasPermission(undefined, "patient:read")).toBe(false)
  })
})

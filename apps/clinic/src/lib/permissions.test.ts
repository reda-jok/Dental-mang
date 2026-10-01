import { describe, expect, it } from "vitest"

import { eligibleRoles, hasPermission, resolvePermission, ROLE_NAMES } from "./permissions"

describe("hasPermission", () => {
  it("gives the owner every permission", () => {
    expect(hasPermission("owner", "accounting:write")).toBe(true)
    expect(hasPermission("owner", "settings:write")).toBe(true)
    expect(hasPermission("owner", "settings:permissions")).toBe(true)
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

  it("lets only dentists and the owner prescribe", () => {
    const allowed = ROLE_NAMES.filter((role) => hasPermission(role, "clinical:prescribe"))
    expect(allowed.sort()).toEqual(["dentist", "owner"])
  })

  it("lets only the owner decide who may discount or void", () => {
    const allowed = ROLE_NAMES.filter((role) => hasPermission(role, "settings:permissions"))
    expect(allowed).toEqual(["owner"])
  })

  it("denies unknown or missing roles", () => {
    expect(hasPermission("hacker", "patient:read")).toBe(false)
    expect(hasPermission(null, "patient:read")).toBe(false)
    expect(hasPermission(undefined, "patient:read")).toBe(false)
  })
})

describe("resolvePermission (adjustable permissions)", () => {
  it("defaults: owner and admin discount, only the owner voids and refunds", () => {
    const discount = ROLE_NAMES.filter((r) => resolvePermission(r, "billing:discount", []))
    const voids = ROLE_NAMES.filter((r) => resolvePermission(r, "billing:void", []))
    const refunds = ROLE_NAMES.filter((r) => resolvePermission(r, "billing:refund", []))
    expect(discount.sort()).toEqual(["admin", "owner"])
    expect(voids).toEqual(["owner"])
    expect(refunds).toEqual(["owner"])
  })

  it("applies the owner's overrides", () => {
    const overrides = [
      { role: "reception", permission: "billing:discount", granted: true },
      { role: "admin", permission: "billing:discount", granted: false },
      { role: "accountant", permission: "billing:void", granted: true },
    ]
    expect(resolvePermission("reception", "billing:discount", overrides)).toBe(true)
    expect(resolvePermission("admin", "billing:discount", overrides)).toBe(false)
    expect(resolvePermission("accountant", "billing:void", overrides)).toBe(true)
    // Other roles keep their defaults.
    expect(resolvePermission("reception", "billing:void", overrides)).toBe(false)
  })

  it("defaults: owner, admin and accountant pay labs; reception can be allowed", () => {
    const pay = ROLE_NAMES.filter((r) => resolvePermission(r, "lab:pay", []))
    expect(pay.sort()).toEqual(["accountant", "admin", "owner"])
    expect(eligibleRoles("lab:pay")).toEqual(["admin", "reception", "accountant"])
    const overrides = [{ role: "reception", permission: "lab:pay", granted: true }]
    expect(resolvePermission("reception", "lab:pay", overrides)).toBe(true)
    // Dentists and assistants work with labs but don't handle money.
    expect(resolvePermission("dentist", "lab:pay", [])).toBe(false)
    expect(resolvePermission("assistant", "lab:pay", [])).toBe(false)
  })

  it("can't lock the owner out", () => {
    const overrides = [{ role: "owner", permission: "billing:void", granted: false }]
    expect(resolvePermission("owner", "billing:void", overrides)).toBe(true)
  })

  it("ignores grants to roles that can't write invoices", () => {
    const overrides = [{ role: "dentist", permission: "billing:void", granted: true }]
    expect(resolvePermission("dentist", "billing:void", overrides)).toBe(false)
    expect(eligibleRoles("billing:void")).toEqual(["admin", "reception", "accountant"])
  })

  it("ignores overrides for fixed permissions", () => {
    const overrides = [{ role: "reception", permission: "settings:write", granted: true }]
    expect(resolvePermission("reception", "settings:write", overrides)).toBe(false)
  })

  it("denies unknown roles", () => {
    expect(resolvePermission("hacker", "billing:discount", [])).toBe(false)
  })
})

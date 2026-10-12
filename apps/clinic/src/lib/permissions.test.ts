import { describe, expect, it } from "vitest"

import {
  ADJUSTABLE_PERMISSIONS,
  defaultHasPermission,
  hasPermission,
  permissionsFor,
  resolvePermission,
  ROLE_NAMES,
} from "./permissions"

describe("defaults", () => {
  it("gives the owner every permission", () => {
    expect(defaultHasPermission("owner", "accounting:write")).toBe(true)
    expect(defaultHasPermission("owner", "settings:write")).toBe(true)
    expect(defaultHasPermission("owner", "settings:permissions")).toBe(true)
  })

  it("keeps clinical records away from reception and accountants", () => {
    expect(defaultHasPermission("reception", "clinical:read")).toBe(false)
    expect(defaultHasPermission("accountant", "clinical:read")).toBe(false)
    expect(defaultHasPermission("dentist", "clinical:write")).toBe(true)
  })

  it("lets only owner/admin change settings", () => {
    const allowed = ROLE_NAMES.filter((role) => defaultHasPermission(role, "settings:write"))
    expect(allowed.sort()).toEqual(["admin", "owner"])
  })

  it("lets only dentists and the owner prescribe", () => {
    const allowed = ROLE_NAMES.filter((role) => defaultHasPermission(role, "clinical:prescribe"))
    expect(allowed.sort()).toEqual(["dentist", "owner"])
  })

  it("lets only the owner decide who may discount or void", () => {
    const allowed = ROLE_NAMES.filter((role) => defaultHasPermission(role, "settings:permissions"))
    expect(allowed).toEqual(["owner"])
  })

  it("denies unknown or missing roles", () => {
    expect(defaultHasPermission("hacker", "patient:read")).toBe(false)
    expect(defaultHasPermission(null, "patient:read")).toBe(false)
    expect(defaultHasPermission(undefined, "patient:read")).toBe(false)
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

  it("needs the prerequisites: a void grant counts only once the role writes invoices", () => {
    const voids = [{ role: "dentist", permission: "billing:void", granted: true }]
    expect(resolvePermission("dentist", "billing:void", voids)).toBe(false)
    const withWrite = [...voids, { role: "dentist", permission: "billing:write", granted: true }]
    expect(resolvePermission("dentist", "billing:void", withWrite)).toBe(true)
  })

  it("removing a permission takes its dependents with it, and gives them back", () => {
    const noPatients = [{ role: "dentist", permission: "patient:read", granted: false }]
    expect(resolvePermission("dentist", "clinical:prescribe", [])).toBe(true)
    // prescribe → write → clinical:read → patient:read
    expect(resolvePermission("dentist", "clinical:prescribe", noPatients)).toBe(false)
    expect(resolvePermission("dentist", "appointment:write", noPatients)).toBe(false)
    expect(resolvePermission("dentist", "appointment:read", noPatients)).toBe(true)
  })

  it("adjusts more than money: settings, booking, clinical records", () => {
    const overrides = [
      { role: "reception", permission: "settings:read", granted: true },
      { role: "reception", permission: "settings:write", granted: true },
      { role: "reception", permission: "appointment:write", granted: false },
      { role: "assistant", permission: "clinical:write", granted: false },
    ]
    expect(resolvePermission("reception", "settings:write", overrides)).toBe(true)
    expect(resolvePermission("reception", "appointment:write", overrides)).toBe(false)
    expect(resolvePermission("assistant", "clinical:write", overrides)).toBe(false)
    expect(resolvePermission("assistant", "clinical:read", overrides)).toBe(true)
  })

  it("ignores overrides for fixed permissions", () => {
    const overrides = [
      { role: "admin", permission: "settings:permissions", granted: true },
      { role: "reception", permission: "user:create", granted: true },
    ]
    expect(resolvePermission("admin", "settings:permissions", overrides)).toBe(false)
    expect(resolvePermission("reception", "user:create", overrides)).toBe(false)
  })

  it("every default already has its prerequisites (so no default is silently off)", () => {
    for (const role of ROLE_NAMES) {
      for (const { permission } of ADJUSTABLE_PERMISSIONS) {
        expect([role, permission, resolvePermission(role, permission, [])]).toEqual([
          role,
          permission,
          defaultHasPermission(role, permission),
        ])
      }
    }
  })

  it("lists prerequisites before the permissions that need them", () => {
    const order = ADJUSTABLE_PERMISSIONS.map((p) => p.permission as string)
    for (const { permission, requires } of ADJUSTABLE_PERMISSIONS) {
      for (const r of requires) expect(order.indexOf(r)).toBeLessThan(order.indexOf(permission))
    }
  })

  it("denies unknown roles", () => {
    expect(resolvePermission("hacker", "billing:discount", [])).toBe(false)
  })
})

describe("hasPermission", () => {
  it("checks the user's resolved permissions, overrides included", () => {
    const overrides = [{ role: "reception", permission: "billing:discount", granted: true }]
    const reception = { permissions: permissionsFor("reception", overrides) }
    expect(hasPermission(reception, "billing:discount")).toBe(true)
    expect(
      hasPermission({ permissions: permissionsFor("reception", []) }, "billing:discount"),
    ).toBe(false)
    expect(hasPermission(null, "patient:read")).toBe(false)
  })
})

describe("commission permissions", () => {
  it("the owner and accountant see every dentist's commission; a dentist only their own", () => {
    expect(defaultHasPermission("owner", "hr:commission")).toBe(true)
    expect(defaultHasPermission("accountant", "hr:commission")).toBe(true)
    expect(defaultHasPermission("admin", "hr:commission")).toBe(false)
    expect(defaultHasPermission("dentist", "hr:commission")).toBe(false)
    expect(defaultHasPermission("dentist", "hr:self")).toBe(true)
    expect(defaultHasPermission("reception", "hr:self")).toBe(false)
  })

  it("only the owner sets a dentist's pay", () => {
    expect(
      ["owner", "admin", "accountant", "dentist"].filter((r) => defaultHasPermission(r, "hr:pay")),
    ).toEqual(["owner"])
  })
})

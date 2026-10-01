import { describe, expect, it } from "vitest"

import { checkUserChange, type Actor, type Target } from "./policy"

const owner: Actor = { id: "owner-1", role: "owner" }
const admin: Actor = { id: "admin-1", role: "admin" }
const ownerTarget: Target = { id: "owner-1", role: "owner", active: true }
const otherOwner: Target = { id: "owner-2", role: "owner", active: true }
const dentist: Target = { id: "dentist-1", role: "dentist", active: true }

describe("checkUserChange", () => {
  it("lets an owner or admin create normal staff", () => {
    expect(checkUserChange(owner, null, { kind: "create", role: "dentist" }, 1)).toBeNull()
    expect(checkUserChange(admin, null, { kind: "create", role: "reception" }, 1)).toBeNull()
  })

  it("lets only an owner create or promote owners", () => {
    expect(checkUserChange(admin, null, { kind: "create", role: "owner" }, 1)).toBe(
      "onlyOwnerManagesOwners",
    )
    expect(checkUserChange(admin, dentist, { kind: "edit", role: "owner" }, 1)).toBe(
      "onlyOwnerManagesOwners",
    )
    expect(checkUserChange(owner, dentist, { kind: "edit", role: "owner" }, 1)).toBeNull()
  })

  it("stops an admin from touching an owner account at all", () => {
    for (const change of [
      { kind: "edit", role: "owner" },
      { kind: "disable" },
      { kind: "resetPassword" },
    ] as const) {
      expect(checkUserChange(admin, otherOwner, change, 2), change.kind).toBe(
        "onlyOwnerManagesOwners",
      )
    }
  })

  it("stops anyone changing their own role or disabling themselves", () => {
    const adminSelf: Target = { id: "admin-1", role: "admin", active: true }
    expect(checkUserChange(admin, adminSelf, { kind: "edit", role: "owner" }, 1)).toBe(
      "onlyOwnerManagesOwners",
    )
    expect(checkUserChange(admin, adminSelf, { kind: "edit", role: "dentist" }, 1)).toBe(
      "cannotChangeOwnRole",
    )
    expect(checkUserChange(admin, adminSelf, { kind: "disable" }, 1)).toBe("cannotDisableSelf")
    // Editing your own name (same role) is fine.
    expect(checkUserChange(admin, adminSelf, { kind: "edit", role: "admin" }, 1)).toBeNull()
  })

  it("never removes the last active owner", () => {
    expect(checkUserChange(owner, ownerTarget, { kind: "edit", role: "admin" }, 1)).toBe(
      "cannotChangeOwnRole",
    )
    const secondOwner: Actor = { id: "owner-2", role: "owner" }
    expect(checkUserChange(secondOwner, ownerTarget, { kind: "disable" }, 1)).toBe("lastOwner")
    expect(checkUserChange(secondOwner, ownerTarget, { kind: "edit", role: "admin" }, 1)).toBe(
      "lastOwner",
    )
  })

  it("allows removing an owner when another active owner remains", () => {
    const secondOwner: Actor = { id: "owner-2", role: "owner" }
    expect(checkUserChange(secondOwner, ownerTarget, { kind: "disable" }, 2)).toBeNull()
    expect(checkUserChange(secondOwner, ownerTarget, { kind: "edit", role: "admin" }, 2)).toBeNull()
  })

  it("lets owners and admins reset staff passwords and re-enable accounts", () => {
    expect(checkUserChange(admin, dentist, { kind: "resetPassword" }, 1)).toBeNull()
    const disabled: Target = { ...dentist, active: false }
    expect(checkUserChange(admin, disabled, { kind: "enable" }, 1)).toBeNull()
  })
})

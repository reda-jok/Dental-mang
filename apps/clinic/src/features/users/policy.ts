// Who may change which staff account, and how. Pure so every rule is unit-tested.
// The service calls this inside the transaction, with a fresh owner count.

import type { RoleName } from "@/lib/permissions"

export type Actor = { id: string; role: RoleName }
export type Target = { id: string; role: RoleName; active: boolean }

export type UserChange =
  | { kind: "create"; role: RoleName }
  | { kind: "edit"; role: RoleName }
  | { kind: "disable" }
  | { kind: "enable" }
  | { kind: "resetPassword" }

/** Translation keys under "errors". */
export type PolicyDenial =
  "onlyOwnerManagesOwners" | "cannotChangeOwnRole" | "cannotDisableSelf" | "lastOwner"

export function checkUserChange(
  actor: Actor,
  target: Target | null,
  change: UserChange,
  activeOwnerCount: number,
): PolicyDenial | null {
  const touchesOwner =
    target?.role === "owner" ||
    ((change.kind === "create" || change.kind === "edit") && change.role === "owner")

  // Admins manage staff; only an owner can create, promote to, or modify an owner.
  if (touchesOwner && actor.role !== "owner") return "onlyOwnerManagesOwners"

  if (!target) return null
  const isSelf = actor.id === target.id

  if (change.kind === "edit" && isSelf && change.role !== target.role) return "cannotChangeOwnRole"
  if (change.kind === "disable" && isSelf) return "cannotDisableSelf"

  // Never leave the clinic without an active owner.
  const removesOwner =
    target.role === "owner" &&
    target.active &&
    (change.kind === "disable" || (change.kind === "edit" && change.role !== "owner"))
  if (removesOwner && activeOwnerCount <= 1) return "lastOwner"

  return null
}

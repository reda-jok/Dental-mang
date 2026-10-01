// Roles & permissions — the single source of truth for who can do what.
// Shared by the server (authorization) and the client (hiding UI the user can't use).
// Ownership rules ("dentist sees own appointments") live in each feature's data layer.
//
// A few permissions are *adjustable*: the owner can grant or remove them per role in
// Settings → Permissions (stored as overrides in the database). Those can only be
// checked on the server with the overrides loaded (`can()` in src/server/permissions.ts);
// the synchronous `hasPermission` accepts only the fixed ones, so TypeScript stops misuse.

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  clinical: ["read", "write"],
  appointment: ["read", "write"],
  billing: ["read", "write", "discount", "void"],
  lab: ["read", "write"],
  accounting: ["read", "write"],
  hr: ["read", "write"],
  inventory: ["read", "write"],
  /** "permissions": edit the adjustable permissions below (owner only). */
  settings: ["read", "write", "permissions"],
} as const

export const ac = createAccessControl(statements)

const everything = {
  patient: ["read", "write", "delete"],
  clinical: ["read", "write"],
  appointment: ["read", "write"],
  billing: ["read", "write", "discount", "void"],
  lab: ["read", "write"],
  accounting: ["read", "write"],
  hr: ["read", "write"],
  inventory: ["read", "write"],
  settings: ["read", "write", "permissions"],
} as const

// Defaults. For adjustable permissions these are only the starting point.
export const roles = {
  owner: ac.newRole({ ...adminAc.statements, ...everything }),
  admin: ac.newRole({
    ...adminAc.statements,
    ...everything,
    clinical: ["read"],
    billing: ["read", "write", "discount"],
    accounting: ["read"],
    settings: ["read", "write"],
  }),
  dentist: ac.newRole({
    patient: ["read", "write"],
    clinical: ["read", "write"],
    appointment: ["read", "write"],
    billing: ["read"],
    lab: ["read", "write"],
    inventory: ["read"],
  }),
  assistant: ac.newRole({
    patient: ["read", "write"],
    clinical: ["read", "write"],
    appointment: ["read"],
    lab: ["read", "write"],
    inventory: ["read", "write"],
  }),
  reception: ac.newRole({
    patient: ["read", "write"],
    appointment: ["read", "write"],
    billing: ["read", "write"],
    lab: ["read"],
    inventory: ["read"],
  }),
  accountant: ac.newRole({
    patient: ["read"],
    billing: ["read", "write"],
    lab: ["read"],
    accounting: ["read", "write"],
    hr: ["read", "write"],
    inventory: ["read"],
  }),
}

export type RoleName = keyof typeof roles
export const ROLE_NAMES = Object.keys(roles) as RoleName[]

type Statements = typeof statements
export type Permission = {
  [R in keyof Statements]: `${R & string}:${Statements[R][number]}`
}[keyof Statements]

/**
 * Permissions the owner can grant or remove per role. `requires`: a role must already
 * have this to be eligible (a discount is given while writing an invoice).
 */
export const ADJUSTABLE_PERMISSIONS = [
  { permission: "billing:discount", requires: "billing:write" },
  { permission: "billing:void", requires: "billing:write" },
] as const satisfies readonly { permission: Permission; requires: Permission }[]

export type AdjustablePermission = (typeof ADJUSTABLE_PERMISSIONS)[number]["permission"]
export type FixedPermission = Exclude<Permission, AdjustablePermission>

/** Owner-made exceptions to the defaults, as stored in the role_permission table. */
export type PermissionOverride = { role: string; permission: string; granted: boolean }

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && value in roles
}

export function isAdjustable(permission: Permission): permission is AdjustablePermission {
  return ADJUSTABLE_PERMISSIONS.some((p) => p.permission === permission)
}

/** The code default, ignoring overrides. */
export function defaultHasPermission(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  if (!isRoleName(role)) return false
  const [resource, action] = permission.split(":") as [keyof Statements, string]
  return roles[role].authorize({ [resource]: [action] } as never).success
}

/** For fixed permissions (safe anywhere, including client components). */
export function hasPermission(role: string | null | undefined, permission: FixedPermission) {
  return defaultHasPermission(role, permission)
}

/** Roles the owner may grant `permission` to: everyone with its prerequisite, except the owner. */
export function eligibleRoles(permission: AdjustablePermission): RoleName[] {
  const { requires } = ADJUSTABLE_PERMISSIONS.find((p) => p.permission === permission)!
  return ROLE_NAMES.filter((role) => role !== "owner" && defaultHasPermission(role, requires))
}

/**
 * The effective permission with the owner's overrides applied. The owner always has
 * everything (an override can't lock them out), and an override only counts for a
 * role that is eligible for it.
 */
export function resolvePermission(
  role: string | null | undefined,
  permission: Permission,
  overrides: readonly PermissionOverride[],
): boolean {
  if (!isRoleName(role)) return false
  if (role === "owner" || !isAdjustable(permission)) return defaultHasPermission(role, permission)
  if (!eligibleRoles(permission).includes(role)) return false
  const override = overrides.find((o) => o.role === role && o.permission === permission)
  return override ? override.granted : defaultHasPermission(role, permission)
}

// Roles & permissions — the single source of truth for who can do what.
// Shared by the server (authorization) and the client (hiding UI the user can't use).
// Ownership rules ("dentist sees own appointments") live in each feature's data layer.
//
// Most permissions are *adjustable*: the owner grants or removes them per role in
// Settings → Permissions (stored as overrides in the database). The signed-in user's
// effective permissions are resolved once per request (`getCurrentUser()`), so check
// them with `hasPermission(user, …)`, never against the role's defaults.

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  /** "prescribe": write prescriptions (dentists and the owner, not assistants). */
  clinical: ["read", "write", "prescribe"],
  appointment: ["read", "write"],
  billing: ["read", "write", "discount", "void", "refund"],
  /** "pay": see what the clinic owes each lab, pay labs and record lab discounts. */
  lab: ["read", "write", "pay"],
  accounting: ["read", "write", "expense", "reports"],
  /**
   * "commission": see every dentist's commission; "self": see your own pay and commission;
   * "pay": set a dentist's pay type and rate (owner only).
   */
  hr: ["read", "write", "commission", "self", "pay"],
  inventory: ["read", "write"],
  /**
   * "permissions": edit the adjustable permissions below (owner only);
   * "activity": the activity history (who did what, from the audit log).
   */
  settings: ["read", "write", "permissions", "activity"],
} as const

export const ac = createAccessControl(statements)

const everything = {
  patient: ["read", "write", "delete"],
  clinical: ["read", "write", "prescribe"],
  appointment: ["read", "write"],
  billing: ["read", "write", "discount", "void", "refund"],
  lab: ["read", "write", "pay"],
  accounting: ["read", "write", "expense", "reports"],
  hr: ["read", "write", "commission", "self", "pay"],
  inventory: ["read", "write"],
  settings: ["read", "write", "permissions", "activity"],
} as const

// Defaults. For adjustable permissions these are only the starting point.
export const roles = {
  owner: ac.newRole({ ...adminAc.statements, ...everything }),
  admin: ac.newRole({
    ...adminAc.statements,
    ...everything,
    clinical: ["read"],
    billing: ["read", "write", "discount"],
    accounting: ["read", "expense"],
    hr: ["read", "write"],
    settings: ["read", "write"],
  }),
  dentist: ac.newRole({
    patient: ["read", "write"],
    clinical: ["read", "write", "prescribe"],
    appointment: ["read", "write"],
    billing: ["read"],
    lab: ["read", "write"],
    hr: ["self"],
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
    lab: ["read", "pay"],
    accounting: ["read", "write", "expense", "reports"],
    hr: ["read", "write", "commission", "self"],
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
 * Permissions the owner can grant or remove per role, in the order Settings → Permissions
 * shows them. `requires`: a role only has the permission while it also has these (a
 * discount is given while writing an invoice), so removing one takes its dependents with it.
 * Not listed (fixed): user and session management (Better Auth checks those itself),
 * `settings:permissions` (owner only), and modules not built yet (inventory).
 */
export const ADJUSTABLE_PERMISSIONS = [
  { permission: "patient:read", requires: [] },
  { permission: "patient:write", requires: ["patient:read"] },
  { permission: "patient:delete", requires: ["patient:write"] },
  { permission: "clinical:read", requires: ["patient:read"] },
  { permission: "clinical:write", requires: ["clinical:read"] },
  { permission: "clinical:prescribe", requires: ["clinical:write"] },
  { permission: "appointment:read", requires: [] },
  // Booking searches patients.
  { permission: "appointment:write", requires: ["appointment:read", "patient:read"] },
  { permission: "billing:read", requires: [] },
  { permission: "billing:write", requires: ["billing:read"] },
  { permission: "billing:discount", requires: ["billing:write"] },
  { permission: "billing:void", requires: ["billing:write"] },
  { permission: "billing:refund", requires: ["billing:write"] },
  { permission: "lab:read", requires: [] },
  { permission: "lab:write", requires: ["lab:read"] },
  // Paying a lab takes money out of the clinic, so only roles that handle money.
  { permission: "lab:pay", requires: ["lab:read", "billing:write"] },
  { permission: "accounting:read", requires: [] },
  // A cash expense comes out of the drawer, like paying a lab.
  { permission: "accounting:expense", requires: ["accounting:read", "billing:write"] },
  { permission: "accounting:reports", requires: ["accounting:read"] },
  { permission: "hr:self", requires: [] },
  { permission: "hr:commission", requires: ["hr:self"] },
  { permission: "hr:pay", requires: ["hr:commission"] },
  { permission: "settings:read", requires: [] },
  { permission: "settings:write", requires: ["settings:read"] },
  // The history names patients.
  { permission: "settings:activity", requires: ["settings:read", "patient:read"] },
] as const satisfies readonly { permission: Permission; requires: readonly Permission[] }[]

export type AdjustablePermission = (typeof ADJUSTABLE_PERMISSIONS)[number]["permission"]

/** Owner-made exceptions to the defaults, as stored in the role_permission table. */
export type PermissionOverride = { role: string; permission: string; granted: boolean }

const ALL_PERMISSIONS = Object.entries(statements).flatMap(([resource, actions]) =>
  actions.map((action) => `${resource}:${action}` as Permission),
)

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && value in roles
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

/**
 * The effective permission with the owner's overrides applied. The owner always has
 * everything (an override can't lock them out), and a permission whose prerequisites
 * the role lacks is off whatever its own setting.
 */
export function resolvePermission(
  role: string | null | undefined,
  permission: Permission,
  overrides: readonly PermissionOverride[],
): boolean {
  if (!isRoleName(role)) return false
  const adjustable = ADJUSTABLE_PERMISSIONS.find((p) => p.permission === permission)
  if (role === "owner" || !adjustable) return defaultHasPermission(role, permission)
  const override = overrides.find((o) => o.role === role && o.permission === permission)
  const own = override ? override.granted : defaultHasPermission(role, permission)
  return own && adjustable.requires.every((r) => resolvePermission(role, r, overrides))
}

/** Everything a role may do, with the owner's overrides applied (see `CurrentUser`). */
export function permissionsFor(
  role: string | null | undefined,
  overrides: readonly PermissionOverride[],
): Permission[] {
  return ALL_PERMISSIONS.filter((p) => resolvePermission(role, p, overrides))
}

/** Safe anywhere, including client components: the user carries their resolved permissions. */
export function hasPermission(
  user: { permissions: readonly Permission[] } | null | undefined,
  permission: Permission,
): boolean {
  return !!user?.permissions.includes(permission)
}

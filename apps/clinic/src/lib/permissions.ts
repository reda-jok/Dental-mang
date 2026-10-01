// Roles & permissions — the single source of truth for who can do what.
// Shared by the server (authorization) and the client (hiding UI the user can't use).
// Ownership rules ("dentist sees own appointments") live in each feature's data layer.

import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const statements = {
  ...defaultStatements,
  patient: ["read", "write", "delete"],
  clinical: ["read", "write"],
  appointment: ["read", "write"],
  billing: ["read", "write", "void"],
  lab: ["read", "write"],
  accounting: ["read", "write"],
  hr: ["read", "write"],
  inventory: ["read", "write"],
  settings: ["read", "write"],
} as const

export const ac = createAccessControl(statements)

const everything = {
  patient: ["read", "write", "delete"],
  clinical: ["read", "write"],
  appointment: ["read", "write"],
  billing: ["read", "write", "void"],
  lab: ["read", "write"],
  accounting: ["read", "write"],
  hr: ["read", "write"],
  inventory: ["read", "write"],
  settings: ["read", "write"],
} as const

export const roles = {
  owner: ac.newRole({ ...adminAc.statements, ...everything }),
  admin: ac.newRole({
    ...adminAc.statements,
    ...everything,
    clinical: ["read"],
    accounting: ["read"],
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
    billing: ["read", "write", "void"],
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

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && value in roles
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!isRoleName(role)) return false
  const [resource, action] = permission.split(":") as [keyof Statements, string]
  return roles[role].authorize({ [resource]: [action] } as never).success
}

import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/server/db"

type AuditEntry = {
  userId: string | null
  action:
    | "create"
    | "update"
    | "delete"
    | "restore"
    | "void"
    | "setup"
    | "login"
    | "login_failed"
    | "disable"
    | "enable"
    | "password_reset"
  entity: string
  entityId?: string
  before?: unknown
  after?: unknown
  ipAddress?: string | null
}

/**
 * Record a change. Call it with the transaction client (`tx`) so the audit row
 * commits or rolls back together with the change it describes.
 */
export async function recordAudit(tx: Db, entry: AuditEntry) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
      ipAddress: entry.ipAddress ?? null,
    },
  })
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  // Round-trip to strip Dates/Decimals into JSON-safe values and drop secrets.
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key === "password" ? undefined : v)),
  ) as Prisma.InputJsonValue
}

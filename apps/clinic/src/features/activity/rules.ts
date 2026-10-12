// The activity history reads the audit log. Pure helpers, shared by the data layer and tests.

export const ACTIVITY_FILTERS = [
  "all",
  "money",
  "patients",
  "appointments",
  "lab",
  "staff",
  "settings",
  "sensitive",
] as const
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]

/** Which audit entities each filter shows. An entity in no area shows only under "all". */
export const ACTIVITY_AREAS = {
  money: [
    "invoice",
    "payment",
    "refund",
    "cash_close",
    "payment_reminder",
    "lab_payment",
    "lab_adjustment",
  ],
  patients: [
    "patient",
    "medical_history",
    "attachment",
    "clinical_note",
    "prescription",
    "tooth_finding",
    "treatment_plan",
    "treatment_plan_item",
  ],
  appointments: ["appointment", "appointment_reminder"],
  lab: ["lab", "lab_case"],
  staff: ["session", "user", "role_permission", "dentist_pay"],
  settings: [
    "clinic",
    "clinic_settings",
    "schedule_settings",
    "clinic_holiday",
    "room",
    "procedure",
    "procedure_catalog",
    "procedure_category",
    "medication",
    "medication_catalog",
    "tooth_condition",
    "dashboard_layout",
    "dashboard_layout_default",
  ],
} as const satisfies Record<Exclude<ActivityFilter, "all" | "sensitive">, readonly string[]>

/** Actions an owner looks for first: money taken back, records removed, break-in attempts. */
export const SENSITIVE_ACTIONS = [
  "void",
  "delete",
  "restore",
  "login_failed",
  "disable",
  "password_reset",
] as const

/** Actions that read as a whole on their own ("تسجيل دخول"), not "<action> <entity>". */
export const STANDALONE_ACTIONS = [
  "login",
  "login_failed",
  "setup",
  "disable",
  "enable",
  "password_reset",
] as const

export type ActivityDetail = {
  /** A human number such as INV-2026-000012. */
  number?: string
  amount?: string
  /** A cash close's counted − expected, when not zero. */
  difference?: string
  reason?: string
  /** The username typed in a failed sign-in. */
  username?: string
  patientId?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function field(payload: unknown, key: string): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === "string" && value !== "" ? value : undefined
}

/**
 * The few facts worth a line in the history, picked from an entry's before/after
 * snapshots (each service writes its own shape, so every field is optional).
 */
export function describe(entry: {
  entity: string
  entityId: string | null
  before: unknown
  after: unknown
}): ActivityDetail {
  const { entity, entityId, before, after } = entry
  const pick = (key: string) => field(after, key) ?? field(before, key)
  const patientId = entity === "patient" ? (entityId ?? undefined) : pick("patientId")
  const difference = entity === "cash_close" ? field(after, "difference") : undefined
  return {
    number: pick("number"),
    amount: entity === "cash_close" ? field(after, "counted") : (pick("amount") ?? pick("total")),
    difference: difference === "0" ? undefined : difference,
    reason: field(after, "reason"),
    username: entity === "session" ? field(after, "username") : undefined,
    patientId: patientId && UUID.test(patientId) ? patientId : undefined,
  }
}

// The dashboard's widgets and how a saved layout becomes what a user sees. Pure: the
// server resolves the layout, the customize dialog edits it.

import type { Permission } from "@/lib/permissions"

/** In default order. "stat" = a small card, "wide" = a full-width panel. */
export const WIDGETS = [
  { key: "totalPatients", permission: "patient:read", size: "stat" },
  { key: "todayCount", permission: "appointment:read", size: "stat" },
  { key: "newPatients", permission: "patient:read", size: "stat" },
  { key: "treatmentValue", permission: "clinical:read", size: "stat" },
  { key: "openPlans", permission: "clinical:read", size: "stat" },
  { key: "labAlerts", permission: "lab:read", size: "wide" },
  { key: "todayAppointments", permission: "appointment:read", size: "wide" },
  { key: "calendar", permission: "appointment:read", size: "wide" },
] as const satisfies readonly { key: string; permission: Permission; size: "stat" | "wide" }[]

export type WidgetKey = (typeof WIDGETS)[number]["key"]
export const WIDGET_KEYS = WIDGETS.map((w) => w.key) as [WidgetKey, ...WidgetKey[]]
export type LayoutItem = { key: WidgetKey; hidden: boolean }

const isWidgetKey = (key: string): key is WidgetKey => (WIDGET_KEYS as string[]).includes(key)

/**
 * What a user sees: the saved order (unknown, repeated or not-allowed widgets dropped),
 * then every allowed widget the saved layout doesn't mention, visible, so new widgets
 * appear without anyone resetting their layout. No saved layout = the default order.
 */
export function resolveLayout(
  saved: readonly { key: string; hidden: boolean }[] | null,
  allowed: ReadonlySet<WidgetKey>,
): LayoutItem[] {
  const out: LayoutItem[] = []
  for (const item of saved ?? []) {
    if (isWidgetKey(item.key) && allowed.has(item.key) && !out.some((o) => o.key === item.key)) {
      out.push({ key: item.key, hidden: item.hidden })
    }
  }
  for (const key of WIDGET_KEYS) {
    if (allowed.has(key) && !out.some((o) => o.key === key)) out.push({ key, hidden: false })
  }
  return out
}

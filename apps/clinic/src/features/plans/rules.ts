// Treatment-plan rules. Pure so every case is unit-tested; the service calls these.

import { isValidTooth, normalizeSurfaces, type Surface } from "../chart/teeth"

export type ToothScope = "none" | "tooth" | "surfaces"

export type ItemTarget = { tooth: number | null; surfaces: Surface[] }

/** Translation keys under "errors". */
export type PlanRuleError =
  "teethRequired" | "teethNotAllowed" | "surfacesRequired" | "invalidTooth" | "tooManyTeeth"

/**
 * Turns the chart selection into plan-item targets for a procedure:
 * whole-mouth → one item without a tooth; per tooth → one item per tooth
 * (each tooth is priced, done and billed separately).
 */
export function planItemTargets(
  scope: ToothScope,
  teeth: number[],
  surfaces: string[],
): { ok: true; targets: ItemTarget[] } | { ok: false; error: PlanRuleError } {
  const uniqueTeeth = [...new Set(teeth)]
  if (uniqueTeeth.some((t) => !isValidTooth(t))) return { ok: false, error: "invalidTooth" }

  if (scope === "none") {
    if (uniqueTeeth.length > 0) return { ok: false, error: "teethNotAllowed" }
    return { ok: true, targets: [{ tooth: null, surfaces: [] }] }
  }
  if (uniqueTeeth.length === 0) return { ok: false, error: "teethRequired" }
  if (uniqueTeeth.length > 32) return { ok: false, error: "tooManyTeeth" }

  const normalized = normalizeSurfaces(surfaces)
  if (scope === "surfaces" && normalized.length === 0)
    return { ok: false, error: "surfacesRequired" }

  return {
    ok: true,
    targets: uniqueTeeth.map((tooth) => ({
      tooth,
      surfaces: scope === "surfaces" ? normalized : [],
    })),
  }
}

export type ItemStatus = "planned" | "in_progress" | "done" | "cancelled"

const ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  planned: ["in_progress", "done", "cancelled"],
  in_progress: ["done", "cancelled", "planned"],
  done: [], // final: done work is billed and drawn on the chart
  cancelled: ["planned"], // re-open by mistake-fix
}

export function canChangeItemStatus(from: ItemStatus, to: ItemStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to)
}

export function allowedItemStatuses(from: ItemStatus): ItemStatus[] {
  return ITEM_TRANSITIONS[from]
}

export type PlanStatus = "proposed" | "accepted" | "completed" | "cancelled"

const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  proposed: ["accepted", "cancelled"],
  accepted: ["cancelled", "proposed"],
  completed: [],
  cancelled: ["proposed"],
}

export function canChangePlanStatus(from: PlanStatus, to: PlanStatus): boolean {
  return PLAN_TRANSITIONS[from].includes(to)
}

/** Items can only be added or changed while the plan is open. */
export function isPlanOpen(status: PlanStatus): boolean {
  return status === "proposed" || status === "accepted"
}

/** A plan completes itself when every item that isn't cancelled is done. */
export function shouldCompletePlan(items: { status: ItemStatus }[]): boolean {
  const active = items.filter((i) => i.status !== "cancelled")
  return active.length > 0 && active.every((i) => i.status === "done")
}

// Lab case rules: pure functions, unit-tested, shared by the forms and the server.

import { toLatinDigits } from "@/lib/validation"

import { ALL_TEETH } from "../chart/teeth"

export type LabStatus = "sent" | "received" | "fitted" | "cancelled"
export type LabAction = "receive" | "fit" | "remake" | "cancel"

/**
 * What can happen next: work at the lab comes back (or is cancelled); work at the
 * clinic is fitted, sent back to be redone, or cancelled. Fitted and cancelled are final.
 */
export function actionsFor(status: LabStatus): LabAction[] {
  switch (status) {
    case "sent":
      return ["receive", "cancel"]
    case "received":
      return ["fit", "remake", "cancel"]
    default:
      return []
  }
}

export function canDo(status: LabStatus, action: LabAction) {
  return actionsFor(status).includes(action)
}

export type DueState = "late" | "today" | "soon" | "onTime"

/** How a case at the lab stands against its due date (null when not at the lab). */
export function dueState(status: LabStatus, dueOn: string, today: string): DueState | null {
  if (status !== "sent") return null
  if (dueOn < today) return "late"
  if (dueOn === today) return "today"
  const days = (Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  return days <= 2 ? "soon" : "onTime"
}

const VALID_TEETH = new Set(ALL_TEETH)

/** "16, 17" / "١٦ ١٧" / "16-17" → [16, 17]; null when a number isn't an FDI tooth. */
export function parseTeeth(text: string): number[] | null {
  const parts = toLatinDigits(text)
    .split(/[\s,،\-/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const teeth: number[] = []
  for (const part of parts) {
    if (!/^\d{2}$/.test(part)) return null
    const tooth = Number(part)
    if (!VALID_TEETH.has(tooth)) return null
    if (!teeth.includes(tooth)) teeth.push(tooth)
  }
  return teeth
}

/** Vita classical shades (and bleach shades) offered in the form; any text is allowed. */
export const SHADES = [
  "A1",
  "A2",
  "A3",
  "A3.5",
  "A4",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "D4",
  "BL1",
  "BL2",
] as const

export const MATERIALS = [
  "zirconia",
  "emax",
  "pfm",
  "metal",
  "acrylic",
  "flexible",
  "composite",
  "other",
] as const

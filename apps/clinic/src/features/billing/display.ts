import type { PaymentState } from "./rules"

/** Badge colours per invoice state, in the same style as appointment statuses. */
export const STATE_BADGE: Record<PaymentState, string> = {
  unpaid: "border border-yellow-500 bg-yellow-50 text-yellow-700",
  partial: "border border-blue-500 bg-blue-50 text-blue-700",
  paid: "border border-green-500 bg-green-50 text-green-700",
  overdue: "border border-red-400 bg-red-50 text-red-700",
  void: "border border-slate-300 bg-slate-50 text-slate-500",
}

/** "16" / "16 MO" for a line or plan item on a tooth. */
export function toothText(tooth: number | null, surfaces: string[]) {
  if (tooth === null) return null
  return surfaces.length ? `${tooth} ${surfaces.join("")}` : String(tooth)
}

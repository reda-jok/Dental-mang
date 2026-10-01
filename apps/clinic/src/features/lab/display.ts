import type { DueState, LabStatus } from "./rules"

export const STATUS_BADGE: Record<LabStatus, string> = {
  sent: "border border-blue-500 bg-blue-50 text-blue-700",
  received: "border border-purple-500 bg-purple-50 text-purple-700",
  fitted: "border border-green-500 bg-green-50 text-green-700",
  cancelled: "border border-slate-300 bg-slate-50 text-slate-500",
}

export const DUE_BADGE: Record<DueState, string> = {
  late: "border border-red-400 bg-red-50 text-red-700",
  today: "border border-orange-500 bg-orange-50 text-orange-700",
  soon: "border border-yellow-500 bg-yellow-50 text-yellow-700",
  onTime: "border border-slate-300 bg-white text-slate-600",
}

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Stat tile in the clinic's design: label + coloured icon, big value, small note. */
export function StatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  note,
}: {
  title: string
  value: ReactNode
  icon: LucideIcon
  iconClassName: string
  note?: ReactNode
}) {
  return (
    <Card className="gap-2 rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", iconClassName)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </CardContent>
    </Card>
  )
}

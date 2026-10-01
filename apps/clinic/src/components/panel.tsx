import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  /** Buttons shown at the end of the header. */
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  /** Heading level for the title (pages already have an h1 in the header). */
  as?: "h2" | "h3"
}

/** Section card in the clinic's design: rounded, soft shadow, white header strip. */
export function Panel({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  as = "h2",
}: Props) {
  const Heading = as
  return (
    <Card
      className={cn("gap-0 overflow-hidden rounded-2xl border-slate-200 py-0 shadow-sm", className)}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white py-4">
        <div className="min-w-0 space-y-1">
          <Heading
            data-slot="card-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-800 md:text-xl"
          >
            {Icon && <Icon className="size-5 shrink-0 text-blue-500" aria-hidden />}
            {title}
          </Heading>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn("p-4 md:p-6", contentClassName)}>{children}</CardContent>
    </Card>
  )
}

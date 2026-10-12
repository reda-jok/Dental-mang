"use client"

import type { LucideIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PillNavItem = {
  key: string
  label: string
  icon?: LucideIcon
  /** Absent = not available yet (shown disabled with `disabledHint`). */
  href?: string
  /** Match the href exactly (for an "overview" tab whose href prefixes the others). */
  exact?: boolean
  disabledHint?: string
}

/** Pill tabs: a Kufic-cut white tray, the active tab in pressed steel with a cyan line. */
export function PillNav({ items, label }: { items: PillNavItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto">
      <div className="tk-pilltray inline-flex min-w-max gap-1 p-1">
        {items.map((item) => {
          const Icon = item.icon
          const inner = (
            <>
              {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
              {item.label}
            </>
          )
          const base =
            "tk-pill flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm transition-all"

          if (!item.href) {
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-disabled
                    className={cn(base, "cursor-not-allowed text-slate-400")}
                  >
                    {inner}
                  </span>
                </TooltipTrigger>
                {item.disabledHint && <TooltipContent>{item.disabledHint}</TooltipContent>}
              </Tooltip>
            )
          }

          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.key}
              href={item.href as Route}
              aria-current={active ? "page" : undefined}
              className={cn(
                base,
                active
                  ? "tk-pill-on shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

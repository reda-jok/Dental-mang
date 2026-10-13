"use client"

import { useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Bar = {
  month: string
  /** Short month name under the bar. */
  name: string
  /** "أكتوبر 2026: 2,980,000 د.ع." — on hover, focus and tap. */
  label: string
  /** Height against the biggest month, 0–1. */
  size: number
  loss: boolean
}

/** Profit per month as bars: one colour, a loss in the destructive colour; the exact figure on tap. */
export function ProfitBars({ bars }: { bars: Bar[] }) {
  return (
    <div className="flex h-44 items-stretch gap-2 sm:gap-4" data-testid="profit-bars">
      {bars.map((bar) => (
        <div key={bar.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex w-full flex-1 items-end justify-center">
            <BarButton bar={bar} />
          </div>
          <span className="text-muted-foreground text-xs">{bar.name}</span>
        </div>
      ))}
    </div>
  )
}

function BarButton({ bar }: { bar: Bar }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={bar.label}
          data-month={bar.month}
          onClick={() => setOpen((o) => !o)}
          style={{ height: `${Math.max(3, Math.round(bar.size * 100))}%` }}
          className={cn(
            "focus-visible:ring-primary w-full max-w-14 rounded-t-lg focus-visible:ring-2 focus-visible:outline-none",
            bar.loss ? "bg-destructive/70" : "bg-primary",
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{bar.label}</TooltipContent>
    </Tooltip>
  )
}

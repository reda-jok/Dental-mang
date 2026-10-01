"use client"

import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Props = Omit<ComponentProps<typeof Button>, "aria-label" | "disabled"> & {
  /** Required: shown as a hover tip and read by screen readers. */
  label: string
  /** When set, the button is disabled and the tip explains why. */
  disabledReason?: string | null
  /** Briefly unavailable while an action runs (tip unchanged). */
  pending?: boolean
}

/** An icon-only button that always has a tooltip and an accessible name. */
export function IconButton({
  label,
  disabledReason,
  pending = false,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: Props) {
  const disabled = !!disabledReason
  const button = (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    />
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons get no pointer events; the wrapper keeps the tip working. */}
        {disabled ? (
          <span tabIndex={0} className="inline-flex" aria-label={`${label}: ${disabledReason}`}>
            {button}
          </span>
        ) : (
          button
        )}
      </TooltipTrigger>
      <TooltipContent>{disabled ? disabledReason : label}</TooltipContent>
    </Tooltip>
  )
}

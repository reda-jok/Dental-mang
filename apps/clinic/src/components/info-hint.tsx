"use client"

import { InfoIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A small ⓘ next to a label that explains a field. Opens on hover, keyboard
 * focus, *and tap* — plain tooltips don't open on touch screens.
 */
export function InfoHint({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common")
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t("moreInfo")}
          className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-full align-middle"
          onClick={(e) => {
            e.preventDefault() // don't focus the input when inside a <label>
            setOpen((o) => !o)
          }}
        >
          <InfoIcon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-start leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  )
}

import { PrinterIcon } from "lucide-react"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"

/** Opens a printable page in a new tab (print dialog opens by itself). */
export function PrintLink({
  href,
  label,
  compact = false,
}: {
  href: string
  label: string
  compact?: boolean
}) {
  const target = `${href}?print=1`
  if (compact) {
    return (
      <IconButton label={label} asChild>
        <a href={target} target="_blank" rel="noopener">
          <PrinterIcon />
        </a>
      </IconButton>
    )
  }
  return (
    <Button variant="outline" asChild>
      <a href={target} target="_blank" rel="noopener">
        <PrinterIcon />
        {label}
      </a>
    </Button>
  )
}

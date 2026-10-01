"use client"

import { PrinterIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

/**
 * Print / close buttons above a printable page (not printed themselves). With
 * `autoPrint`, the print dialog opens as soon as the fonts have loaded.
 */
export function PrintToolbar({ autoPrint, hint }: { autoPrint: boolean; hint: string }) {
  const t = useTranslations("print")

  useEffect(() => {
    if (!autoPrint) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) window.print()
    })
    return () => {
      cancelled = true
    }
  }, [autoPrint])

  return (
    <div className="mx-auto mb-4 flex max-w-xl flex-wrap items-center justify-center gap-3 px-4 print:hidden">
      <Button onClick={() => window.print()}>
        <PrinterIcon />
        {t("print")}
      </Button>
      <Button variant="outline" onClick={() => window.close()}>
        <XIcon />
        {t("close")}
      </Button>
      <p className="w-full text-center text-xs text-slate-500">{hint}</p>
    </div>
  )
}

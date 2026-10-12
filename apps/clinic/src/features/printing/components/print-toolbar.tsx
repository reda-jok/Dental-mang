"use client"

import { PrinterIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

/**
 * Print / close buttons above a printable page (not printed themselves). With
 * `autoPrint`, the print dialog opens as soon as the fonts and images have loaded.
 */
export function PrintToolbar({ autoPrint, hint }: { autoPrint: boolean; hint: string }) {
  const t = useTranslations("print")

  useEffect(() => {
    if (!autoPrint) return
    let cancelled = false
    // The logo too: a printout without it would look like another clinic's.
    const images = [...document.images].map((img) =>
      img.complete
        ? null
        : new Promise((done) => {
            img.addEventListener("load", done, { once: true })
            img.addEventListener("error", done, { once: true })
          }),
    )
    void Promise.all([document.fonts.ready, ...images]).then(() => {
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

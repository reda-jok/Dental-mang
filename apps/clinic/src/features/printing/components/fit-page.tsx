"use client"

import { useEffect, useRef, type ReactNode } from "react"

/** Printable height of each paper: the page less the @page margins in globals.css. */
const PRINTABLE_MM = { A5: 190, A4: 269 } as const

/**
 * Keeps a printout on one page: once the fonts are in, it measures the content against
 * the paper; if it's too tall it hides the parts marked `data-optional`, and if it's
 * still too tall it scales the content down to fit. Sets `data-fitted` when done.
 */
export function FitPage({
  paper,
  children,
}: {
  paper: keyof typeof PRINTABLE_MM
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      const max = (PRINTABLE_MM[paper] * 96) / 25.4
      const optional = el.querySelectorAll<HTMLElement>("[data-optional]")
      el.style.zoom = ""
      optional.forEach((node) => (node.hidden = false))
      if (el.offsetHeight > max) optional.forEach((node) => (node.hidden = true))
      if (el.offsetHeight > max)
        el.style.zoom = String(Math.floor((max / el.offsetHeight) * 100) / 100)
      el.dataset.fitted = el.style.zoom || "1"
    })
    return () => {
      cancelled = true
    }
  }, [paper])

  return <div ref={ref}>{children}</div>
}

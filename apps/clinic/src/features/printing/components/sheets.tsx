import type { ReactNode } from "react"

import type { Letterhead } from "@/features/settings/data"
import { cn } from "@/lib/utils"
import { formatLocalPhone } from "@/lib/validation"

/** An 80 mm thermal slip (72 mm printable), black on white, slightly heavier text. */
export function ThermalSheet({ children }: { children: ReactNode }) {
  return (
    <article className="print-thermal mx-auto w-[72mm] bg-white p-[3mm] text-[12px] leading-snug font-medium text-black shadow-sm print:p-0 print:shadow-none">
      {children}
    </article>
  )
}

/** An A4 page; on small screens it scrolls sideways rather than reflowing. */
export function A4Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <article className="print-a4 mx-auto min-h-[297mm] w-[210mm] bg-white p-[14mm] text-[13px] text-black shadow-sm print:min-h-0 print:w-auto print:p-0 print:shadow-none">
        {children}
      </article>
    </div>
  )
}

/** Clinic name, address and phone at the top of every printout. */
export function LetterheadBlock({
  letterhead,
  align = "center",
}: {
  letterhead: Letterhead
  align?: "center" | "start"
}) {
  return (
    <header className={cn("space-y-0.5", align === "center" && "text-center")}>
      <p className="text-base font-bold">{letterhead.name}</p>
      {letterhead.address && <p>{letterhead.address}</p>}
      {letterhead.phone && (
        <p>
          <bdi>{formatLocalPhone(letterhead.phone)}</bdi>
        </p>
      )}
    </header>
  )
}

/** A dashed rule between sections of a thermal slip. */
export function Rule() {
  return <hr className="my-2 border-t border-dashed border-black" />
}

/** "label ........ value" row. */
export function Row({
  label,
  children,
  strong = false,
}: {
  label: ReactNode
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2", strong && "font-bold")}>
      <span>{label}</span>
      <span className="text-end">{children}</span>
    </div>
  )
}

/** A money amount kept left-to-right inside Arabic text. */
export function Amount({ value }: { value: string }) {
  return <span dir="ltr">{value}</span>
}

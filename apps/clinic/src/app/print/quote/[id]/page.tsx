import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getPlanPaid } from "@/features/billing/data"
import { getPlanQuote } from "@/features/plans/data"
import { ClinicCopy, PatientQuote } from "@/features/printing/components/plan-quote"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { QuoteOptions } from "@/features/printing/components/quote-options"
import { quoteOptionsSchema } from "@/features/printing/quote"
import { getLetterhead } from "@/features/settings/data"
import { todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("quoteTitle") }
}

// No automatic print here: the copies and the payment plan are chosen first.
export default async function QuotePrintPage({
  params,
  searchParams,
}: PageProps<"/print/quote/[id]">) {
  const user = await requirePagePermission("clinical:read")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [plan, letterhead, t, options] = await Promise.all([
    getPlanQuote(id),
    getLetterhead(),
    getTranslations("print"),
    searchParams.then((p) => quoteOptionsSchema.parse(p)),
  ])
  if (!plan) notFound()
  const paid = hasPermission(user, "billing:read") ? await getPlanPaid(plan.id) : null
  const pay = options.pay ?? (plan.phases.length > 1 ? "phase" : "full")
  const props = {
    plan,
    letterhead,
    today: todayIso(letterhead.timezone),
    paid,
    payment: { mode: pay, months: options.months, depositPercent: options.deposit },
  }
  return (
    <>
      <PrintToolbar autoPrint={false} hint={t("a4Hint")} />
      <QuoteOptions
        copies={options.copies}
        pay={pay}
        months={options.months}
        deposit={options.deposit}
      />
      <div className="space-y-6 print:space-y-0">
        {options.copies !== "clinic" && <PatientQuote {...props} />}
        {options.copies !== "patient" && (
          <div className={options.copies === "both" ? "break-before-page" : undefined}>
            <ClinicCopy {...props} />
          </div>
        )}
      </div>
    </>
  )
}

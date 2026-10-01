import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getPlanQuote } from "@/features/plans/data"
import { PlanQuote } from "@/features/printing/components/plan-quote"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { getLetterhead } from "@/features/settings/data"
import { todayIso } from "@/lib/dates"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("quoteTitle") }
}

export default async function QuotePrintPage({
  params,
  searchParams,
}: PageProps<"/print/quote/[id]">) {
  await requirePagePermission("clinical:read")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [plan, letterhead, t, { print }] = await Promise.all([
    getPlanQuote(id),
    getLetterhead(),
    getTranslations("print"),
    searchParams,
  ])
  if (!plan) notFound()
  return (
    <>
      <PrintToolbar autoPrint={print === "1"} hint={t("a4Hint")} />
      <PlanQuote plan={plan} letterhead={letterhead} today={todayIso(letterhead.timezone)} />
    </>
  )
}

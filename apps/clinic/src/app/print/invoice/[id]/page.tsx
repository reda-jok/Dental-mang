import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getInvoice } from "@/features/billing/data"
import { InvoiceSlip } from "@/features/printing/components/invoice-slip"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { getLetterhead } from "@/features/settings/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("invoiceTitle") }
}

export default async function InvoicePrintPage({
  params,
  searchParams,
}: PageProps<"/print/invoice/[id]">) {
  await requirePagePermission("billing:read")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [invoice, letterhead, t, { print }] = await Promise.all([
    getInvoice(id),
    getLetterhead(),
    getTranslations("print"),
    searchParams,
  ])
  if (!invoice) notFound()
  return (
    <>
      <PrintToolbar autoPrint={print === "1"} hint={t("thermalHint")} />
      <InvoiceSlip invoice={invoice} letterhead={letterhead} />
    </>
  )
}

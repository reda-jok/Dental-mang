import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getPaymentReceipt } from "@/features/billing/data"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { Receipt } from "@/features/printing/components/receipt"
import { getLetterhead } from "@/features/settings/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("receiptTitle") }
}

export default async function ReceiptPrintPage({
  params,
  searchParams,
}: PageProps<"/print/receipt/[id]">) {
  await requirePagePermission("billing:write")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [receipt, letterhead, t, { print }] = await Promise.all([
    getPaymentReceipt(id),
    getLetterhead(),
    getTranslations("print"),
    searchParams,
  ])
  if (!receipt) notFound()
  return (
    <>
      <PrintToolbar autoPrint={print === "1"} hint={t("thermalHint")} />
      <Receipt receipt={receipt} letterhead={letterhead} />
    </>
  )
}

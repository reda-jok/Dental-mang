import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getPrescriptionForPrint } from "@/features/prescriptions/data"
import { PrescriptionSheet } from "@/features/printing/components/prescription-sheet"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { getLetterhead } from "@/features/settings/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("prescriptionTitle") }
}

export default async function PrescriptionPrintPage({
  params,
  searchParams,
}: PageProps<"/print/prescription/[id]">) {
  await requirePagePermission("clinical:read")
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const [prescription, letterhead, t, { print }] = await Promise.all([
    getPrescriptionForPrint(id),
    getLetterhead(),
    getTranslations("print"),
    searchParams,
  ])
  if (!prescription) notFound()
  return (
    <>
      <PrintToolbar autoPrint={print === "1"} hint={t("a4Hint")} />
      <PrescriptionSheet prescription={prescription} letterhead={letterhead} />
    </>
  )
}

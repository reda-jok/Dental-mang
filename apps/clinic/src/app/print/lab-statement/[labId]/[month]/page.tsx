import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { z } from "zod"

import { getLabStatement } from "@/features/lab/data"
import { labStatementSearchSchema } from "@/features/lab/schemas"
import { LabStatementSheet } from "@/features/printing/components/lab-statement-sheet"
import { PrintToolbar } from "@/features/printing/components/print-toolbar"
import { getLetterhead } from "@/features/settings/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("print")
  return { title: t("labStatementTitle") }
}

export default async function LabStatementPrintPage({
  params,
  searchParams,
}: PageProps<"/print/lab-statement/[labId]/[month]">) {
  await requirePagePermission("lab:pay")
  const { labId, month: rawMonth } = await params
  const { month } = labStatementSearchSchema.parse({ month: rawMonth })
  if (!z.uuid().safeParse(labId).success || !month) notFound()
  const [statement, letterhead, t, { print }] = await Promise.all([
    getLabStatement(labId, month),
    getLetterhead(),
    getTranslations("print"),
    searchParams,
  ])
  if (!statement) notFound()
  return (
    <>
      <PrintToolbar autoPrint={print === "1"} hint={t("a4Hint")} />
      <LabStatementSheet statement={statement} letterhead={letterhead} />
    </>
  )
}

"use client"

import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import type { InvoiceFormData } from "../data"
import { NewInvoiceDialog } from "./new-invoice-dialog"

/** "New invoice" on the patient's billing tab; opens by itself when linked with ?new=. */
export function NewInvoiceButton({
  patientId,
  data,
  initialKind,
}: {
  patientId: string
  data: InvoiceFormData
  initialKind?: "visit" | "plan"
}) {
  const t = useTranslations("billing")
  const [open, setOpen] = useState(!!initialKind)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        {t("new")}
      </Button>
      <NewInvoiceDialog
        patientId={patientId}
        data={data}
        open={open}
        onOpenChange={setOpen}
        initialKind={initialKind}
      />
    </>
  )
}

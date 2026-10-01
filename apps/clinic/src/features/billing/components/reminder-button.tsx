"use client"

import { MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import { WhatsAppDialog, type WhatsAppDraft } from "@/components/whatsapp-dialog"
import { useActionErrorHandler } from "@/lib/form"
import { formatMoney } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"
import { paymentReminderMessage } from "@/lib/whatsapp"

import { logPaymentReminderAction } from "../actions"

type Props = {
  patient: { id: string; fullName: string; phone: string | null }
  /** What to ask for: the overdue amount. */
  amount: string
  oldestDue: string | null
  clinic: { name: string; phone: string | null }
  compact?: boolean
}

/**
 * Opens a WhatsApp payment reminder (editable before sending) and logs it, so staff can
 * see when the patient was last reminded.
 */
export function ReminderButton({ patient, amount, oldestDue, clinic, compact = false }: Props) {
  const t = useTranslations("billing")
  const handleError = useActionErrorHandler()
  const [draft, setDraft] = useState<WhatsAppDraft | null>(null)
  const [, startTransition] = useTransition()
  const label = t("remind", { name: patient.fullName })

  const open = () =>
    patient.phone &&
    setDraft({
      kind: "payment",
      phone: patient.phone,
      patientName: patient.fullName,
      message: paymentReminderMessage({
        clinicName: clinic.name,
        patientName: patient.fullName,
        amount: formatMoney(amount, "IQD"),
        dueDate: oldestDue,
        clinicPhone: clinic.phone ? formatLocalPhone(clinic.phone) : null,
      }),
    })

  const logged = () =>
    startTransition(async () => {
      const result = await logPaymentReminderAction({ patientId: patient.id })
      if (!result.ok) return handleError(result)
      toast.success(t("reminderLogged"))
    })

  return (
    <>
      {compact ? (
        <IconButton
          label={label}
          disabledReason={patient.phone ? null : t("noPhone")}
          onClick={open}
          className="text-green-700"
        >
          <MessageCircleIcon />
        </IconButton>
      ) : (
        <Button
          variant="outline"
          className="text-green-700"
          disabled={!patient.phone}
          onClick={open}
        >
          <MessageCircleIcon />
          {t("remindShort")}
        </Button>
      )}
      <WhatsAppDialog draft={draft} onClose={() => setDraft(null)} onSent={logged} />
    </>
  )
}

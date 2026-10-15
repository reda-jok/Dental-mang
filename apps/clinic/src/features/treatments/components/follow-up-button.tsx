"use client"

import { MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { IconButton } from "@/components/icon-button"
import { useBooking } from "@/features/appointments/components/booking-provider"
import { formatLocalPhone } from "@/lib/validation"
import { planFollowUpMessage } from "@/lib/whatsapp"

type Props = {
  patient: { fullName: string; phone: string | null }
  /** What comes next in the plan, as one line. */
  nextTreatment: string | null
  clinic: { name: string; phone: string | null }
}

/** A WhatsApp message inviting the patient to book the next step of their plan (editable before sending). */
export function FollowUpButton({ patient, nextTreatment, clinic }: Props) {
  const t = useTranslations("treatments.call")
  const { openWhatsApp } = useBooking()
  return (
    <IconButton
      label={t("message", { name: patient.fullName })}
      disabledReason={patient.phone ? null : t("noPhone")}
      className="text-green-700"
      onClick={() =>
        patient.phone &&
        openWhatsApp({
          kind: "followUp",
          phone: patient.phone,
          patientName: patient.fullName,
          message: planFollowUpMessage({
            clinicName: clinic.name,
            patientName: patient.fullName,
            nextTreatment,
            clinicPhone: clinic.phone ? formatLocalPhone(clinic.phone) : null,
          }),
        })
      }
    >
      <MessageCircleIcon />
    </IconButton>
  )
}

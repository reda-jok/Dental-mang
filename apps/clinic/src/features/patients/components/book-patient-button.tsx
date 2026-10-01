"use client"

import { CalendarPlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { useBooking } from "@/features/appointments/components/booking-provider"

/** "Book appointment" on the patient page: opens the booking form with this patient. */
export function BookPatientButton({
  patient,
}: {
  patient: { id: string; fullName: string; phone: string | null }
}) {
  const t = useTranslations("patients")
  const { openBooking } = useBooking()
  if (!openBooking) return null
  return (
    <Button className="shadow-md" onClick={() => openBooking({ patient })}>
      <CalendarPlusIcon />
      {t("bookAppointment")}
    </Button>
  )
}

"use client"

import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"

import { useActionErrorHandler } from "@/lib/form"

import { logReminderAction } from "../actions"

/** Logs that WhatsApp was opened with an appointment reminder. */
export function useLogReminder() {
  const t = useTranslations("reminders")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const log = (appointmentId: string) =>
    startTransition(async () => {
      const result = await logReminderAction({ appointmentId })
      if (!result.ok) return handleError(result)
      toast.success(t("logged"))
    })
  return { log, pending }
}

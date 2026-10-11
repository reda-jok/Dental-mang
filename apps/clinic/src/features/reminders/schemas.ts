import { z } from "zod"

import { parseIsoDate } from "@/lib/dates"
import { uuid } from "@/lib/validation"

export const logReminderSchema = z.strictObject({ appointmentId: uuid })

export const REMINDER_FILTERS = ["all", "todo"] as const

/** ?date=YYYY-MM-DD&show=all|todo (bad values → defaults). */
export const reminderParams = z.object({
  date: z
    .string()
    .refine((v) => parseIsoDate(v) !== null)
    .optional()
    .catch(undefined),
  show: z.enum(REMINDER_FILTERS).catch("all"),
})

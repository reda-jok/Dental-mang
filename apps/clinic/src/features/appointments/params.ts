import { z } from "zod"

import { parseIsoDate } from "@/lib/dates"

const isoDateParam = z
  .string()
  .refine((v) => parseIsoDate(v) !== null)
  .optional()
  .catch(undefined)

/** ?date=YYYY-MM-DD&view=day|week for the scheduler (bad values → defaults). */
export const schedulerParams = z.object({
  date: isoDateParam,
  view: z.enum(["day", "week"]).catch("day"),
})

/** ?cal=YYYY-MM-DD&view=month|week for the dashboard calendar. */
export const calendarParams = z.object({
  cal: isoDateParam,
  view: z.enum(["month", "week"]).catch("month"),
})

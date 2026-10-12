import { z } from "zod"

import { isoDate, uuid } from "@/lib/validation"

import { ACTIVITY_FILTERS } from "./rules"

/** The history's filters, read from the URL; anything odd falls back to "everything". */
export const activitySearchSchema = z.object({
  person: uuid.catch(""),
  area: z.enum(ACTIVITY_FILTERS).catch("all"),
  day: isoDate.catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
})

export type ActivitySearch = z.output<typeof activitySearchSchema>

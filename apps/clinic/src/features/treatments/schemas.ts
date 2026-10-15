import { z } from "zod"

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const page = z.coerce.number().int().min(1).max(10_000).catch(1).default(1)
const q = z.string().trim().max(100).optional().catch(undefined)

export const openPlansParams = z.object({
  q,
  status: z.enum(["proposed", "accepted"]).optional().catch(undefined),
  page,
})

export const plansToCallParams = z.object({ q, page })

export const workParams = z.object({
  q,
  month: z.string().regex(MONTH).optional().catch(undefined),
  /** A dentist's id, or "none" for treatments with no dentist. */
  dentist: z.string().max(40).optional().catch(undefined),
})

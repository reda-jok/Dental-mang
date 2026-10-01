import { notFound } from "next/navigation"
import { cache } from "react"
import { z } from "zod"

import { getPatient } from "@/features/patients/data"

/** One DB read per request, shared by the layout and the page. */
export const loadPatient = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound()
  const patient = await getPatient(id)
  if (!patient) notFound()
  return patient
})

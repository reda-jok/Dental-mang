import "server-only"

import { connection } from "next/server"
import { cache } from "react"

import { db } from "@/server/db"
import { authorize } from "@/server/session"

/**
 * Public clinic info (name, phone, currency, timezone). Not permission-guarded because
 * the app shell needs it for every signed-in user; it holds nothing sensitive.
 */
export const getClinicSettings = cache(async () => {
  await connection() // request-time only; never query during build
  return db.clinicSettings.findUnique({
    where: { id: 1 },
    select: { name: true, phone: true, currency: true, timezone: true },
  })
})

/** Full settings for the settings form. */
export async function getClinicSettingsForEdit() {
  await authorize("settings:read")
  return db.clinicSettings.findUnique({
    where: { id: 1 },
    select: { name: true, phone: true, address: true, receiptFooter: true, invoiceDueDays: true },
  })
}

import "server-only"

import { connection } from "next/server"
import { cache } from "react"

import { db } from "@/server/db"
import { authorize, requireUser } from "@/server/session"

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
    select: {
      name: true,
      phone: true,
      address: true,
      receiptFooter: true,
      invoiceDueDays: true,
      printPaper: true,
    },
  })
}

/** The clinic's details printed on receipts and quotes. */
export const getLetterhead = cache(async () => {
  await requireUser()
  const settings = await db.clinicSettings.findUnique({
    where: { id: 1 },
    select: {
      name: true,
      phone: true,
      address: true,
      receiptFooter: true,
      timezone: true,
      printPaper: true,
    },
  })
  return {
    name: settings?.name ?? "",
    phone: settings?.phone ?? null,
    address: settings?.address ?? null,
    footer: settings?.receiptFooter ?? null,
    timezone: settings?.timezone ?? "Asia/Baghdad",
    paper: settings?.printPaper ?? "A5",
  }
})

export type Letterhead = Awaited<ReturnType<typeof getLetterhead>>

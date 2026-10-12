"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import type { BookingOptions, ScheduleConfig } from "../data"
import { BookingDialog, type BookingPrefill } from "./booking-dialog"
import { WhatsAppDialog, type WhatsAppDraft } from "@/components/whatsapp-dialog"

type BookingContext = {
  /** Null when the user may not book appointments. Bookings start from a patient. */
  openBooking: ((prefill: BookingPrefill) => void) | null
  /** Open the WhatsApp message dialog (reminders, completed visits…). */
  openWhatsApp: (draft: WhatsAppDraft) => void
  config: ScheduleConfig
}

const Ctx = createContext<BookingContext | null>(null)

/** Lets the patient page and the plan open the booking form, and any page the WhatsApp dialog. */
export function BookingProvider({
  options,
  config,
  children,
}: {
  options: BookingOptions | null
  config: ScheduleConfig
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null)
  const [draft, setDraft] = useState<WhatsAppDraft | null>(null)

  const openBooking = useCallback((p: BookingPrefill) => {
    setPrefill(p)
    setOpen(true)
  }, [])

  const value = useMemo(
    () => ({ openBooking: options ? openBooking : null, openWhatsApp: setDraft, config }),
    [options, openBooking, config],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {options && (
        <BookingDialog
          open={open}
          onOpenChange={setOpen}
          prefill={prefill}
          options={options}
          config={config}
          onBooked={(d) => {
            setOpen(false)
            if (d) setDraft(d)
          }}
        />
      )}
      <WhatsAppDialog draft={draft} onClose={() => setDraft(null)} />
    </Ctx.Provider>
  )
}

export function useBooking() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useBooking must be used inside <BookingProvider>")
  return ctx
}

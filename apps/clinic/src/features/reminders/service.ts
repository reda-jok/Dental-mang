import "server-only"

import type { z } from "zod"

import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { clockOf, type Clock } from "../billing/service"
import type { logReminderSchema } from "./schemas"

/**
 * Logs a WhatsApp appointment reminder (the message itself goes from the user's phone).
 * Sending again is allowed and logged again; only waiting appointments can be reminded.
 */
export async function logAppointmentReminder(
  actor: CurrentUser,
  input: z.output<typeof logReminderSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { at } = await clockOf(tx, clock)
    const appointment = await tx.appointment.findFirst({
      where: { id: input.appointmentId, patient: { deletedAt: null } },
      select: { status: true, patient: { select: { phone: true } } },
    })
    if (!appointment) throw new AppError("not_found")
    if (appointment.status !== "pending") throw new AppError("conflict", "reminderNotWaiting")
    if (!appointment.patient.phone) throw new AppError("validation", "reminderNoPhone")

    const reminder = await tx.appointmentReminder.create({
      data: { appointmentId: input.appointmentId, sentById: actor.id, sentAt: at },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "appointment_reminder",
      entityId: reminder.id,
      after: { appointmentId: input.appointmentId, channel: "whatsapp" },
    })
    return reminder
  })
}

import "server-only"

import type { z } from "zod"

import { addDays, isoDateInZone } from "@/lib/dates"
import { recordAudit } from "@/server/audit"
import { db, type Db } from "@/server/db"
import { env } from "@/server/env"
import { AppError } from "@/server/errors"
import type { CurrentUser } from "@/server/session"

import { clockOf, type Clock } from "../billing/service"
import { canDeleteNote, canReviseNote, isLocked, NOTE_VISIT_DAYS, type NoteBlock } from "./rules"
import type {
  createClinicalNoteSchema,
  deleteClinicalNoteSchema,
  reviseClinicalNoteSchema,
} from "./schemas"

/**
 * Saves and signs a note for a visit: an appointment of the last two weeks, or today
 * without one. The text becomes version 1.
 */
export async function createClinicalNote(
  actor: CurrentUser,
  input: z.output<typeof createClinicalNoteSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { day, at } = await clockOf(tx, clock)
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")

    let visitOn = day
    if (input.appointmentId) {
      const appointment = await tx.appointment.findFirst({
        where: {
          id: input.appointmentId,
          patientId: patient.id,
          status: { notIn: ["cancelled", "no_show"] },
        },
        select: { startsAt: true },
      })
      const appointmentDay = appointment && isoDateInZone(appointment.startsAt, env.CLINIC_TIMEZONE)
      if (
        !appointmentDay ||
        appointmentDay > day ||
        appointmentDay < addDays(day, -NOTE_VISIT_DAYS)
      ) {
        throw new AppError("validation", "noteAppointmentMissing")
      }
      visitOn = appointmentDay
    }

    const note = await tx.clinicalNote.create({
      data: {
        patientId: patient.id,
        appointmentId: input.appointmentId,
        authorId: actor.id,
        visitOn: new Date(`${visitOn}T00:00:00Z`),
        createdAt: at,
        versions: {
          create: { version: 1, body: input.body, writtenById: actor.id, createdAt: at },
        },
      },
      select: { id: true },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "create",
      entity: "clinical_note",
      entityId: note.id,
      after: { patientId: patient.id, appointmentId: input.appointmentId, visitOn },
    })
    return note
  })
}

/**
 * Changes a note's text by adding a version. The author's change within 24 hours is a
 * correction; later it is an amendment. Either way the earlier text is kept.
 */
export async function reviseClinicalNote(
  actor: CurrentUser,
  input: z.output<typeof reviseClinicalNoteSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { at } = await clockOf(tx, clock)
    const note = await loadNote(tx, input.id)
    const check = canReviseNote(note, actor.id)
    if (!check.ok) throw blockError(check.reason)

    const latest = await tx.clinicalNoteVersion.findFirst({
      where: { noteId: input.id },
      orderBy: { version: "desc" },
      select: { version: true, body: true },
    })
    if (!latest || latest.version !== input.version) throw new AppError("conflict", "noteChanged")
    if (latest.body === input.body) return { patientId: note.patientId, version: latest.version }

    const version = latest.version + 1
    await tx.clinicalNoteVersion.create({
      data: { noteId: input.id, version, body: input.body, writtenById: actor.id, createdAt: at },
    })
    await recordAudit(tx, {
      userId: actor.id,
      action: "update",
      entity: "clinical_note",
      entityId: input.id,
      before: { version: latest.version, body: latest.body },
      after: { version, body: input.body, amendment: isLocked(note.signedAt, at) },
    })
    return { patientId: note.patientId, version }
  })
}

/** Deletes a note (soft): the author, within 24 hours of signing. */
export async function deleteClinicalNote(
  actor: CurrentUser,
  input: z.output<typeof deleteClinicalNoteSchema>,
  clock?: Clock,
) {
  return db.$transaction(async (tx) => {
    const { at } = await clockOf(tx, clock)
    const note = await loadNote(tx, input.id)
    const check = canDeleteNote(note, actor.id, at)
    if (!check.ok) throw blockError(check.reason)

    const deleted = await tx.clinicalNote.updateMany({
      where: { id: input.id, deletedAt: null },
      data: { deletedAt: at, deletedById: actor.id },
    })
    if (deleted.count === 0) throw new AppError("not_found")
    await recordAudit(tx, {
      userId: actor.id,
      action: "delete",
      entity: "clinical_note",
      entityId: input.id,
      before: { patientId: note.patientId },
    })
    return { patientId: note.patientId }
  })
}

async function loadNote(tx: Db, id: string) {
  const note = await tx.clinicalNote.findFirst({
    where: { id, patient: { deletedAt: null } },
    select: { patientId: true, authorId: true, createdAt: true, deletedAt: true },
  })
  if (!note) throw new AppError("not_found")
  return {
    patientId: note.patientId,
    authorId: note.authorId,
    signedAt: note.createdAt,
    deleted: note.deletedAt !== null,
  }
}

function blockError(reason: NoteBlock) {
  if (reason === "deleted") return new AppError("not_found")
  return new AppError("forbidden", reason === "locked" ? "noteLocked" : "noteNotAuthor")
}

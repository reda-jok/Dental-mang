import "server-only"

import { addDays, isoDateInZone, startOfDayUtc, toIsoDate, todayIso } from "@/lib/dates"
import { db } from "@/server/db"
import { env } from "@/server/env"
import { authorize } from "@/server/session"

import { canDeleteNote, canReviseNote, isAmendment, isLocked, NOTE_VISIT_DAYS } from "./rules"

const tz = () => env.CLINIC_TIMEZONE

/**
 * A patient's visit notes, newest visit first, each with its current text, its earlier
 * versions, the treatments marked done that day, and what the current user may do with it.
 */
export async function listClinicalNotes(patientId: string) {
  const user = await authorize("clinical:read")
  const now = new Date()
  const rows = await db.clinicalNote.findMany({
    where: { patientId, deletedAt: null, patient: { deletedAt: null } },
    orderBy: [{ visitOn: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      visitOn: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
      appointment: { select: { startsAt: true } },
      versions: {
        orderBy: { version: "asc" },
        select: {
          version: true,
          body: true,
          createdAt: true,
          writtenBy: { select: { name: true } },
        },
      },
    },
  })

  const treatments = await doneTreatmentsByDay(
    patientId,
    rows.map((r) => toIsoDate(r.visitOn)),
  )

  return rows.map(({ id, visitOn, createdAt, authorId, author, appointment, versions }) => {
    const current = versions.at(-1)!
    const facts = { authorId, signedAt: createdAt, deleted: false }
    const history = versions.slice(0, -1).map((v) => ({
      version: v.version,
      body: v.body,
      writtenAt: v.createdAt,
      writtenByName: v.writtenBy?.name ?? null,
      amendment: isAmendment(v.createdAt, createdAt),
    }))
    const lastAmendment = versions.findLast((v) => isAmendment(v.createdAt, createdAt))
    const day = toIsoDate(visitOn)
    return {
      id,
      visitOn: day,
      signedAt: createdAt,
      authorName: author?.name ?? null,
      appointmentAt: appointment?.startsAt ?? null,
      version: current.version,
      body: current.body,
      locked: isLocked(createdAt, now),
      amendedAt: lastAmendment?.createdAt ?? null,
      corrected: versions.some((v) => v.version > 1 && !isAmendment(v.createdAt, createdAt)),
      history: history.reverse(),
      treatments: treatments.get(day) ?? [],
      revise: canReviseNote(facts, user.id),
      remove: canDeleteNote(facts, user.id, now),
    }
  })
}

export type ClinicalNoteView = Awaited<ReturnType<typeof listClinicalNotes>>[number]

/** Plan items marked done on the given clinic days, grouped by day. */
async function doneTreatmentsByDay(patientId: string, days: string[]) {
  const byDay = new Map<string, { id: string; tooth: number | null; name: string }[]>()
  if (days.length === 0) return byDay
  const sorted = [...new Set(days)].sort()
  const items = await db.treatmentPlanItem.findMany({
    where: {
      status: "done",
      plan: { patientId },
      completedAt: {
        gte: startOfDayUtc(sorted[0]!, tz()),
        lt: startOfDayUtc(addDays(sorted.at(-1)!, 1), tz()),
      },
    },
    orderBy: [{ completedAt: "asc" }, { tooth: "asc" }],
    select: { id: true, tooth: true, completedAt: true, procedure: { select: { name: true } } },
  })
  const wanted = new Set(sorted)
  for (const item of items) {
    const day = isoDateInZone(item.completedAt!, tz())
    if (!wanted.has(day)) continue
    const list = byDay.get(day) ?? []
    list.push({ id: item.id, tooth: item.tooth, name: item.procedure.name })
    byDay.set(day, list)
  }
  return byDay
}

/** The patient's recent appointments a note can be written for (the last two weeks). */
export async function getClinicalNoteFormData(patientId: string) {
  await authorize("clinical:write")
  const today = todayIso(tz())
  const rows = await db.appointment.findMany({
    where: {
      patientId,
      status: { notIn: ["cancelled", "no_show"] },
      startsAt: {
        gte: startOfDayUtc(addDays(today, -NOTE_VISIT_DAYS), tz()),
        lt: startOfDayUtc(addDays(today, 1), tz()),
      },
    },
    orderBy: { startsAt: "desc" },
    take: 30,
    select: {
      id: true,
      startsAt: true,
      dentist: { select: { name: true } },
      procedure: { select: { name: true } },
    },
  })
  return {
    today,
    visits: rows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt,
      date: isoDateInZone(r.startsAt, tz()),
      dentistName: r.dentist?.name ?? null,
      procedureName: r.procedure?.name ?? null,
    })),
  }
}

export type ClinicalNoteFormData = Awaited<ReturnType<typeof getClinicalNoteFormData>>

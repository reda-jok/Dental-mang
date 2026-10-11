// Who may change a clinical note, and when. Pure functions: the service enforces them,
// the UI uses the same answers to explain a disabled button.

/** A note can be corrected or deleted by its author for this long after signing. */
export const NOTE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

/** How far back a note can be written for an appointment. */
export const NOTE_VISIT_DAYS = 14

type NoteFacts = { authorId: string | null; signedAt: Date; deleted: boolean }

export type NoteBlock = "notAuthor" | "locked" | "deleted"
export type NoteCheck = { ok: true } | { ok: false; reason: NoteBlock }

/** After the window the text can still change, but only as a visible amendment. */
export function isLocked(signedAt: Date, now: Date): boolean {
  return now.getTime() - signedAt.getTime() >= NOTE_EDIT_WINDOW_MS
}

/** Only the author changes a note: within 24 hours as a correction, later as an amendment. */
export function canReviseNote(note: NoteFacts, userId: string): NoteCheck {
  if (note.deleted) return { ok: false, reason: "deleted" }
  if (!note.authorId || note.authorId !== userId) return { ok: false, reason: "notAuthor" }
  return { ok: true }
}

/** Deleting (e.g. written on the wrong patient) is for the author, within 24 hours. */
export function canDeleteNote(note: NoteFacts, userId: string, now: Date): NoteCheck {
  const revise = canReviseNote(note, userId)
  if (!revise.ok) return revise
  if (isLocked(note.signedAt, now)) return { ok: false, reason: "locked" }
  return { ok: true }
}

/** A version written after the note locked is an amendment (shown with its date). */
export function isAmendment(versionAt: Date, signedAt: Date): boolean {
  return isLocked(signedAt, versionAt)
}

import { describe, expect, it } from "vitest"

import { canDeleteNote, canReviseNote, isAmendment, isLocked, NOTE_EDIT_WINDOW_MS } from "./rules"

const signedAt = new Date("2026-10-05T09:00:00Z")
const hours = (h: number) => new Date(signedAt.getTime() + h * 60 * 60 * 1000)
const note = { authorId: "author", signedAt, deleted: false }

describe("isLocked", () => {
  it("locks exactly 24 hours after signing", () => {
    expect(isLocked(signedAt, hours(23.99))).toBe(false)
    expect(isLocked(signedAt, new Date(signedAt.getTime() + NOTE_EDIT_WINDOW_MS))).toBe(true)
    expect(isLocked(signedAt, hours(48))).toBe(true)
  })
})

describe("canReviseNote", () => {
  it("lets only the author change the note, before and after the lock", () => {
    expect(canReviseNote(note, "author")).toEqual({ ok: true })
    expect(canReviseNote(note, "someone-else")).toEqual({ ok: false, reason: "notAuthor" })
  })

  it("refuses a note whose author's account is gone, and a deleted note", () => {
    expect(canReviseNote({ ...note, authorId: null }, "author")).toEqual({
      ok: false,
      reason: "notAuthor",
    })
    expect(canReviseNote({ ...note, deleted: true }, "author")).toEqual({
      ok: false,
      reason: "deleted",
    })
  })
})

describe("canDeleteNote", () => {
  it("allows the author to delete within 24 hours only", () => {
    expect(canDeleteNote(note, "author", hours(2))).toEqual({ ok: true })
    expect(canDeleteNote(note, "author", hours(25))).toEqual({ ok: false, reason: "locked" })
  })

  it("never lets someone else delete, even within the window", () => {
    expect(canDeleteNote(note, "someone-else", hours(1))).toEqual({
      ok: false,
      reason: "notAuthor",
    })
  })
})

describe("isAmendment", () => {
  it("marks versions written after the lock as amendments", () => {
    expect(isAmendment(signedAt, signedAt)).toBe(false) // the original
    expect(isAmendment(hours(3), signedAt)).toBe(false) // a correction
    expect(isAmendment(hours(30), signedAt)).toBe(true)
  })
})

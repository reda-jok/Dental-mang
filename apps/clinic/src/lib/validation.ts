// Building blocks for every Zod schema in the app. They run in the browser (instant
// feedback) and again on the server (the check that actually counts).
// Error messages are keys under "validation" in messages/ar.json.

import { parsePhoneNumberFromString } from "libphonenumber-js/min"
import { z } from "zod"

import { parseIsoDate } from "@/lib/dates"

// Control characters (except tab/newline), zero-width characters and bidi overrides.
// Bidi overrides (U+202A–U+202E, U+2066–U+2069) can make stored text *display*
// differently from what it is — e.g. to impersonate a patient or staff name.
const UNSAFE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g

/** ٠١٢٣ / ۰۱۲۳ → 0123, so numbers typed on an Arabic keyboard just work. */
export function toLatinDigits(value: string): string {
  return value.replace(ARABIC_INDIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
}

/** Unicode-normalize, strip unsafe characters, collapse whitespace, trim. */
export function cleanText(value: string, { multiline = false } = {}): string {
  const cleaned = value.normalize("NFC").replace(UNSAFE_CHARS, "")
  if (multiline) {
    return cleaned
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
  return cleaned.replace(/\s+/g, " ").trim()
}

/** Required single-line text. */
export const text = (min: number, max: number) =>
  z
    .string({ error: "required" })
    .transform((v) => cleanText(v))
    .pipe(z.string().min(1, "required").min(min, "tooShort").max(max, "tooLong"))

/** Optional single-line text: empty → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? cleanText(v) : ""))
    .pipe(z.string().max(max, "tooLong"))
    .transform((v) => v || null)

/** Optional multi-line text (notes, footers): empty → null. */
export const optionalMultiline = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? cleanText(v, { multiline: true }) : ""))
    .pipe(z.string().max(max, "tooLong"))
    .transform((v) => v || null)

/**
 * Iraqi phone in any common form (07xx…, 7xx…, +964…, 00964…, Arabic digits,
 * spaces/dashes) → E.164 "+9647XXXXXXXXX".
 */
export function normalizeIraqiPhone(raw: string): string | null {
  const digits = toLatinDigits(raw)
    .replace(/[\s\-().]/g, "")
    .replace(/^00/, "+")
  const phone = parsePhoneNumberFromString(digits, "IQ")
  return phone?.isValid() ? phone.number : null
}

/** +9647701234567 → 0770 123 4567 (how Iraqis read numbers). */
export function formatLocalPhone(e164: string) {
  const m = /^\+964(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164
}

export const optionalPhone = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const trimmed = v?.trim()
    if (!trimmed) return null
    const phone = normalizeIraqiPhone(trimmed)
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" })
      return z.NEVER
    }
    return phone
  })

/** Required Iraqi phone → E.164. */
export const phone = z.string({ error: "required" }).transform((v, ctx) => {
  const trimmed = v.trim()
  if (!trimmed) {
    ctx.addIssue({ code: "custom", message: "required" })
    return z.NEVER
  }
  const normalized = normalizeIraqiPhone(trimmed)
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "phoneInvalid" })
    return z.NEVER
  }
  return normalized
})

export const username = z
  .string({ error: "required" })
  .transform((v) => toLatinDigits(v).trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "required")
      .min(3, "tooShort")
      .max(30, "tooLong")
      .regex(/^[a-z0-9_.]+$/, "usernameFormat"),
  )

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "11111111",
  "00000000",
  "password",
  "password1",
  "qwerty123",
  "qwertyuiop",
  "iloveyou",
  "admin123",
  "dentist123",
  "clinic123",
])

export const password = z
  .string({ error: "required" })
  .min(1, "required")
  .min(8, "tooShort")
  .max(128, "tooLong")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "passwordTooCommon")
  .refine((v) => new Set(v).size >= 4, "passwordTooSimple")

export const uuid = z.uuid("invalid")

/** A calendar day "YYYY-MM-DD" (Arabic digits accepted). */
export const isoDate = z
  .string({ error: "required" })
  .transform((v) => toLatinDigits(v).trim())
  .refine((v) => parseIsoDate(v) !== null, "invalidDate")

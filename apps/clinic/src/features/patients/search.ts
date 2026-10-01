import { normalizeArabic } from "@/lib/arabic"

/** "+9647701234567" → ["07701234567", "9647701234567"] so any way of typing it matches. */
function phoneForms(e164: string | null): string[] {
  if (!e164) return []
  const digits = e164.replace(/\D/g, "")
  return digits.startsWith("964") ? [`0${digits.slice(3)}`, digits] : [digits]
}

/** Everything a patient can be found by, normalized the same way as queries. */
export function buildSearchText(p: {
  fullName: string
  code?: string | null
  phone: string | null
  phone2: string | null
}): string {
  return [
    normalizeArabic(p.fullName),
    p.code ? normalizeArabic(p.code) : "",
    ...phoneForms(p.phone),
    ...phoneForms(p.phone2),
  ]
    .filter(Boolean)
    .join(" ")
}

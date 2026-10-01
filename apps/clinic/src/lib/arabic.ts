// Arabic text normalization for search. Applied to both the stored search text and
// the user's query, so spelling variants match: "احمد" finds "أحمد",
// "فاطمه" finds "فاطمة", diacritics and tatweel are ignored.

import { toLatinDigits } from "@/lib/validation"

// Harakat/tashkeel (fatha, damma, kasra, shadda, sukun, tanween, superscript alef…)
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g
const TATWEEL = /ـ/g

const LETTER_VARIANTS: Record<string, string> = {
  أ: "ا", // أ → ا
  إ: "ا", // إ → ا
  آ: "ا", // آ → ا
  ٱ: "ا", // ٱ → ا
  ة: "ه", // ة → ه
  ى: "ي", // ى → ي
  ؤ: "و", // ؤ → و
  ئ: "ي", // ئ → ي
  ی: "ي", // Persian ی → ي
  ک: "ك", // Persian ک → ك
}
const LETTER_VARIANT_RE = new RegExp(`[${Object.keys(LETTER_VARIANTS).join("")}]`, "g")

export function normalizeArabic(value: string): string {
  return toLatinDigits(value.normalize("NFC"))
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(LETTER_VARIANT_RE, (ch) => LETTER_VARIANTS[ch] ?? ch)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ") // punctuation (incl. "+") → space
    .replace(/\s+/g, " ")
    .trim()
}

/** Search tokens from a user query (max 5, each at least 1 character). */
export function searchTokens(query: string): string[] {
  return normalizeArabic(query).split(" ").filter(Boolean).slice(0, 5)
}

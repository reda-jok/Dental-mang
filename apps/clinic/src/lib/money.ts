// Money: exact decimals, never floats. Amounts travel as strings ("250000", "120.50")
// and are summed with integer minor units (fils/cents) so 0.1 + 0.2 problems can't happen.

import { z } from "zod"

import { toLatinDigits } from "@/lib/validation"

export const CURRENCIES = ["IQD", "USD"] as const
export type Currency = (typeof CURRENCIES)[number]

/** Decimal places people actually use: whole dinars, dollars with cents. */
export const DECIMALS: Record<Currency, number> = { IQD: 0, USD: 2 }

const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/

/**
 * User input → canonical amount string. Accepts Arabic digits, thousands
 * separators and spaces: "٢٥٠,٠٠٠" → "250000". Returns null when invalid.
 */
export function parseAmount(raw: string, currency: Currency): string | null {
  const cleaned = toLatinDigits(raw)
    .replace(/[\s,٬]/g, "") // spaces, commas, Arabic thousands separator
    .replace(/٫/g, ".") // Arabic decimal separator
  if (!AMOUNT.test(cleaned)) return null
  const [whole, fraction = ""] = cleaned.split(".")
  if (fraction.length > DECIMALS[currency]) return null
  const normalizedWhole = whole!.replace(/^0+(?=\d)/, "")
  return fraction && Number(fraction) !== 0
    ? `${normalizedWhole}.${fraction.padEnd(2, "0")}`
    : normalizedWhole
}

/** Zod field for an amount typed in a form; `currency` decides allowed decimals. */
export function amountField(currencyOf: () => Currency = () => "IQD") {
  return z.string({ error: "required" }).transform((v, ctx) => {
    if (!v.trim()) {
      ctx.addIssue({ code: "custom", message: "required" })
      return z.NEVER
    }
    const amount = parseAmount(v, currencyOf())
    if (amount === null) {
      ctx.addIssue({ code: "custom", message: "invalidAmount" })
      return z.NEVER
    }
    return amount
  })
}

/** A canonical, non-negative amount string as produced by `parseAmount` ("250000", "120.50"). */
export function isAmount(value: string): boolean {
  return AMOUNT.test(value)
}

/** Optional amount typed in a form (discounts): empty → "0". */
export function optionalAmountField(currency: Currency = "IQD") {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return "0"
      const amount = parseAmount(v, currency)
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: "invalidAmount" })
        return z.NEVER
      }
      return amount
    })
}

/** "120.5" → 12050 minor units (cents / fils). */
export function toMinor(amount: string): bigint {
  const [whole, fraction = ""] = amount.split(".")
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2))
}

export function fromMinor(minor: bigint): string {
  const negative = minor < 0n
  const abs = negative ? -minor : minor
  const whole = abs / 100n
  const fraction = abs % 100n
  const text = fraction === 0n ? `${whole}` : `${whole}.${String(fraction).padStart(2, "0")}`
  return negative ? `-${text}` : text
}

/** Totals per currency (mixed-currency plans are normal: implants in USD, the rest in IQD). */
export function sumByCurrency(lines: { amount: string; currency: Currency }[]) {
  const totals = new Map<Currency, bigint>()
  for (const { amount, currency } of lines) {
    totals.set(currency, (totals.get(currency) ?? 0n) + toMinor(amount))
  }
  return CURRENCIES.filter((c) => totals.has(c)).map((currency) => ({
    currency,
    amount: fromMinor(totals.get(currency)!),
  }))
}

export function subtractAmounts(a: string, b: string): string {
  return fromMinor(toMinor(a) - toMinor(b))
}

/** "250000" IQD → "250,000 د.ع." ; "120.5" USD → "US$ 120.50" (Western digits). */
export function formatMoney(amount: string, currency: Currency, locale = "ar-u-nu-latn") {
  const digits = DECIMALS[currency]
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount)) // display only; Number is exact for these magnitudes
}

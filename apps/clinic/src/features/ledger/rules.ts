import { isAmount, toMinor } from "@/lib/money"

import type { AccountKey } from "./accounts"

/** One side of a journal entry. Exactly one of debit / credit is a positive amount. */
export type PostingLine = {
  account: AccountKey
  debit?: string
  credit?: string
  memo?: string
}

export type PostingProblem = "tooFewLines" | "invalidLine" | "unbalanced"

/** Why these lines can't be posted, or null when they can (mirrors the database guards). */
export function postingProblem(lines: readonly PostingLine[]): PostingProblem | null {
  if (lines.length < 2) return "tooFewLines"
  let debits = 0n
  let credits = 0n
  for (const { debit = "0", credit = "0" } of lines) {
    if (!isAmount(debit) || !isAmount(credit)) return "invalidLine"
    const d = toMinor(debit)
    const c = toMinor(credit)
    if (d > 0n === c > 0n) return "invalidLine" // both sides, or neither
    debits += d
    credits += c
  }
  return debits === credits ? null : "unbalanced"
}

/** The lines of an entry that cancels `lines`: every debit becomes a credit and back. */
export function reversalLines<T extends { debit?: string; credit?: string }>(lines: readonly T[]) {
  return lines.map(({ debit, credit, ...rest }) => ({ ...rest, debit: credit, credit: debit }))
}

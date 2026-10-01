import "server-only"

import { parseIsoDate } from "@/lib/dates"
import type { Db } from "@/server/db"
import { AppError } from "@/server/errors"

import { ACCOUNTS } from "./accounts"
import { postingProblem, reversalLines, type PostingLine } from "./rules"

/** What a journal entry records; the business record it came from is `source.id`. */
export type JournalSource = "invoice" | "payment" | "refund" | "cash_close" | "manual"

type PostInput = {
  /** Accounting date: the clinic calendar day (YYYY-MM-DD). */
  date: string
  description: string
  source: { type: JournalSource; id?: string }
  lines: PostingLine[]
  userId: string | null
}

/**
 * Posts a balanced journal entry. Called by other services with their transaction
 * client, so the entry commits or rolls back with the business change it records.
 * The caller has already authorized the user. An unbalanced entry is a programming
 * error (the database would refuse it at commit anyway).
 */
export async function postJournal(tx: Db, input: PostInput) {
  const problem = postingProblem(input.lines)
  if (problem) throw new Error(`ledger: ${problem} (${input.description})`)
  const date = parseIsoDate(input.date)
  if (!date) throw new Error(`ledger: invalid date ${input.date}`)

  const codes = [...new Set(input.lines.map((line) => ACCOUNTS[line.account]))]
  const accounts = await tx.ledgerAccount.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  })
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]))
  const missing = codes.filter((code) => !idByCode.has(code))
  if (missing.length) throw new Error(`ledger: missing accounts ${missing.join(", ")}`)

  return tx.journalEntry.create({
    data: {
      date,
      description: input.description,
      sourceType: input.source.type,
      sourceId: input.source.id,
      createdById: input.userId,
      lines: {
        create: input.lines.map((line) => ({
          accountId: idByCode.get(ACCOUNTS[line.account])!,
          debit: line.debit ?? "0",
          credit: line.credit ?? "0",
          memo: line.memo,
        })),
      },
    },
    select: { id: true, number: true },
  })
}

/**
 * Cancels a posted entry with a mirror-image entry (the original is never edited).
 * An entry can be reversed only once.
 */
export async function reverseJournal(
  tx: Db,
  entryId: string,
  input: Omit<PostInput, "lines" | "source"> & { source?: PostInput["source"] },
) {
  const original = await tx.journalEntry.findUnique({
    where: { id: entryId },
    select: {
      sourceType: true,
      sourceId: true,
      reversesId: true,
      reversedBy: { select: { id: true } },
    },
  })
  if (!original) throw new AppError("not_found")
  if (original.reversedBy || original.reversesId) throw new AppError("conflict", "alreadyReversed")
  // Separate read: inside a transaction, load at most one relation per query.
  const originalLines = await tx.journalLine.findMany({
    where: { entryId },
    select: { accountId: true, debit: true, credit: true, memo: true },
  })
  const date = parseIsoDate(input.date)
  if (!date) throw new Error(`ledger: invalid date ${input.date}`)

  const lines = reversalLines(
    originalLines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    })),
  )

  return tx.journalEntry.create({
    data: {
      date,
      description: input.description,
      sourceType: input.source?.type ?? original.sourceType,
      sourceId: input.source ? input.source.id : original.sourceId,
      reversesId: entryId,
      createdById: input.userId,
      lines: { create: lines },
    },
    select: { id: true, number: true },
  })
}

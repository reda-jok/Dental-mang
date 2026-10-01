import { getFormatter, getTranslations } from "next-intl/server"

import type { LabStatementView } from "@/features/lab/data"
import type { Letterhead } from "@/features/settings/data"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, toMinor } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"

import { Amount, LetterheadBlock, PaperSheet } from "./sheets"

/** A lab's monthly statement, to agree the bill with the lab (A5 or A4, per settings). */
export async function LabStatementSheet({
  statement,
  letterhead,
}: {
  statement: LabStatementView
  letterhead: Letterhead
}) {
  const t = await getTranslations("print")
  const tl = await getTranslations("lab")
  const format = await getFormatter()
  const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />
  const balance = (amount: string) =>
    toMinor(amount) < 0n ? (
      <>
        {money(amount.slice(1))}{" "}
        <span className="text-[10px]">({tl("statement.creditBalance")})</span>
      </>
    ) : (
      money(amount)
    )
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "numeric", timeZone: "UTC" })
  const month = format.dateTime(parseIsoDate(statement.range.start)!, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const { lab, totals } = statement

  return (
    <PaperSheet paper={letterhead.paper}>
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <LetterheadBlock letterhead={letterhead} align="start" />
        <div className="text-end">
          <p className="text-xl font-bold">{t("labStatementTitle")}</p>
          <p>{t("labStatementMonth", { month })}</p>
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("lab")}:</dt>
          <dd className="font-semibold" data-testid="statement-lab">
            {lab.name}
          </dd>
        </div>
        {lab.contactName && <dd>{lab.contactName}</dd>}
        {lab.phone && (
          <dd>
            <bdi>{formatLocalPhone(lab.phone)}</bdi>
          </dd>
        )}
      </dl>

      <table className="mt-4 w-full border-collapse text-start">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="w-12 py-1.5 text-start font-semibold">{tl("statement.columns.date")}</th>
            <th className="py-1.5 text-start font-semibold">{tl("statement.columns.details")}</th>
            <th className="w-24 py-1.5 text-end font-semibold">{tl("statement.columns.added")}</th>
            <th className="w-24 py-1.5 text-end font-semibold">
              {tl("statement.columns.deducted")}
            </th>
            <th className="w-28 py-1.5 text-end font-semibold">
              {tl("statement.columns.balance")}
            </th>
          </tr>
        </thead>
        <tbody data-testid="statement-rows">
          <tr className="border-b border-slate-300">
            <td className="py-1">{day(statement.range.start)}</td>
            <td className="py-1" colSpan={3}>
              {tl("statement.openingRow")}
            </td>
            <td className="py-1 text-end font-medium">{balance(statement.opening)}</td>
          </tr>
          {statement.rows
            .filter((row) => !row.voided)
            .map((row) => {
              const adds = row.kind === "bill" || row.kind === "charge"
              return (
                <tr
                  key={`${row.kind}-${row.id}`}
                  className="break-inside-avoid border-b border-slate-300"
                >
                  <td className="py-1 align-top">{day(row.date)}</td>
                  <td className="py-1">
                    <span className="font-medium">{tl(`statement.kinds.${row.kind}`)}</span>
                    {row.number && (
                      <span className="ms-1">
                        <bdi>{row.number}</bdi>
                      </span>
                    )}
                    <span className="block text-[0.9em] text-slate-700">
                      {row.kind === "bill"
                        ? `${row.patient?.fullName ?? ""} · ${row.work ?? ""}${
                            row.teeth?.length ? ` (${row.teeth.join(", ")})` : ""
                          }`
                        : row.kind === "payment"
                          ? tl(`pay.methods.${row.method === "wallet" ? "wallet" : "cash"}`)
                          : row.reason}
                    </span>
                  </td>
                  <td className="py-1 text-end align-top">{adds && money(row.amount)}</td>
                  <td className="py-1 text-end align-top">{!adds && money(row.amount)}</td>
                  <td className="py-1 text-end align-top font-medium">{balance(row.balance)}</td>
                </tr>
              )
            })}
        </tbody>
      </table>

      <div className="ms-auto mt-4 w-72 space-y-1 border-t-2 border-black pt-2">
        <div className="flex justify-between">
          <span>{tl("statement.opening")}</span>
          {balance(statement.opening)}
        </div>
        <div className="flex justify-between">
          <span>{tl("statement.totals.billed")}</span>
          {money(totals.billed)}
        </div>
        {toMinor(totals.charged) > 0n && (
          <div className="flex justify-between">
            <span>{tl("statement.totals.charged")}</span>
            {money(totals.charged)}
          </div>
        )}
        {toMinor(totals.discounted) > 0n && (
          <div className="flex justify-between">
            <span>{tl("statement.totals.discounted")}</span>
            {money(totals.discounted)}
          </div>
        )}
        <div className="flex justify-between">
          <span>{tl("statement.totals.paid")}</span>
          {money(totals.paid)}
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>{tl("statement.closing")}</span>
          <span data-testid="statement-total">{balance(statement.closing)}</span>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center">
        <div className="border-t border-black pt-2">{t("clinicSignature")}</div>
        <div className="border-t border-black pt-2">{t("labSignature")}</div>
      </div>
    </PaperSheet>
  )
}

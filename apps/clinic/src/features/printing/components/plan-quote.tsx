import { getFormatter, getTranslations } from "next-intl/server"

import type { PlanQuote as PlanQuoteData } from "@/features/plans/data"
import type { Letterhead } from "@/features/settings/data"
import { ageInYears, parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"

import { Amount, LetterheadBlock, PaperSheet } from "./sheets"

/** How long a printed quote's prices hold. */
export const QUOTE_VALID_DAYS = 30

/** A treatment plan as a quote the patient takes home (A5 or A4, per clinic settings). */
export async function PlanQuote({
  plan,
  letterhead,
  today,
}: {
  plan: PlanQuoteData
  letterhead: Letterhead
  today: string
}) {
  const t = await getTranslations("print")
  const tp = await getTranslations("plans")
  const format = await getFormatter()
  const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />
  const age = plan.patient.birthDate ? ageInYears(plan.patient.birthDate, today) : null
  const discounts = plan.items.some((item) => item.discount !== "0")
  const columns = discounts ? 5 : 4

  return (
    <PaperSheet paper={letterhead.paper}>
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <LetterheadBlock letterhead={letterhead} align="start" />
        <div className="text-end">
          <p className="text-xl font-bold">{t("quoteTitle")}</p>
          <p>{format.dateTime(parseIsoDate(today)!, { dateStyle: "long", timeZone: "UTC" })}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("patient")}:</dt>
          <dd className="font-semibold">{plan.patient.fullName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("code")}:</dt>
          <dd>
            <bdi>{plan.patient.code}</bdi>
          </dd>
        </div>
        {age !== null && (
          <div className="flex gap-2">
            <dt className="text-slate-600">{t("age")}:</dt>
            <dd>{t("years", { count: age })}</dd>
          </div>
        )}
        {plan.patient.phone && (
          <div className="flex gap-2">
            <dt className="text-slate-600">{t("phone")}:</dt>
            <dd>
              <bdi>{formatLocalPhone(plan.patient.phone)}</bdi>
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("plan")}:</dt>
          <dd className="font-semibold">{plan.title}</dd>
        </div>
        {plan.createdByName && (
          <div className="flex gap-2">
            <dt className="text-slate-600">{t("dentist")}:</dt>
            <dd>{plan.createdByName}</dd>
          </div>
        )}
      </dl>

      <table className="mt-6 w-full border-collapse text-start">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 text-start font-semibold">{t("procedure")}</th>
            <th className="w-14 py-2 text-start font-semibold">{tp("tooth")}</th>
            <th className="w-28 py-2 text-end font-semibold">{t("price")}</th>
            {discounts && <th className="w-24 py-2 text-end font-semibold">{t("discount")}</th>}
            <th className="w-28 py-2 text-end font-semibold">{t("net")}</th>
          </tr>
        </thead>
        {plan.phases.map((phase) => (
          <tbody key={phase} className="break-inside-avoid">
            {plan.phases.length > 1 && (
              <tr>
                <td colSpan={columns} className="pt-3 pb-1 font-semibold">
                  {tp("phase", { phase: String(phase) })}
                </td>
              </tr>
            )}
            {plan.items
              .filter((item) => item.phase === phase)
              .map((item) => (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="py-1.5">{item.procedureName}</td>
                  <td className="py-1.5">
                    {item.tooth !== null && (
                      <bdi>{`${item.tooth}${item.surfaces.length ? ` ${item.surfaces.join("")}` : ""}`}</bdi>
                    )}
                  </td>
                  <td className="py-1.5 text-end">{money(item.price)}</td>
                  {discounts && (
                    <td className="py-1.5 text-end">
                      {item.discount === "0" ? "—" : money(item.discount)}
                    </td>
                  )}
                  <td className="py-1.5 text-end font-medium">{money(item.net)}</td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>

      <div className="ms-auto mt-4 w-72 space-y-1 border-t-2 border-black pt-2">
        {plan.discount.some((d) => d.amount !== "0") &&
          plan.discount.map((d) => (
            <div key={d.currency} className="flex justify-between">
              <span>{t("discount")}</span>
              {money(d.amount)}
            </div>
          ))}
        {plan.total.map((total) => (
          <div key={total.currency} className="flex justify-between text-base font-bold">
            <span>{t("total")}</span>
            <span data-testid="quote-total">{money(total.amount)}</span>
          </div>
        ))}
      </div>

      {plan.notes && (
        <p className="mt-6 whitespace-pre-line">
          <span className="font-semibold">{t("notes")}: </span>
          {plan.notes}
        </p>
      )}

      <ul className="mt-6 list-disc space-y-1 ps-5 text-[12px] text-slate-700">
        <li>{t("quoteValid", { days: String(QUOTE_VALID_DAYS) })}</li>
        <li>{t("quoteCurrency")}</li>
        <li>{t("quoteMayChange")}</li>
      </ul>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center">
        <div className="border-t border-black pt-2">{t("dentistSignature")}</div>
        <div className="border-t border-black pt-2">{t("patientSignature")}</div>
      </div>

      {letterhead.footer && (
        <p className="mt-10 text-center text-[12px] whitespace-pre-line text-slate-600">
          {letterhead.footer}
        </p>
      )}
    </PaperSheet>
  )
}

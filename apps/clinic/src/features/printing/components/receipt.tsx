import { getFormatter, getTranslations } from "next-intl/server"

import type { PaymentReceipt } from "@/features/billing/data"
import { sumAmounts } from "@/features/billing/payments"
import type { Letterhead } from "@/features/settings/data"
import { formatMoney, subtractAmounts, toMinor } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"

import { FitPage } from "./fit-page"
import { Amount, LetterheadBlock, PaperSheet, Row, Rule, ThermalSheet } from "./sheets"

type Props = { receipt: PaymentReceipt; letterhead: Letterhead }

/** A payment receipt on the clinic's receipt paper (Settings → Clinic): A5 or 80 mm. */
export async function Receipt(props: Props) {
  return props.letterhead.receiptPaper === "thermal80" ? (
    <ThermalReceipt {...props} />
  ) : (
    <A5Receipt {...props} />
  )
}

/** Part of the payment not applied to an invoice stays as the patient's credit. */
function unappliedOf(receipt: PaymentReceipt) {
  const unapplied = subtractAmounts(
    receipt.amount,
    sumAmounts(receipt.appliedTo.map((a) => a.amount)),
  )
  return toMinor(unapplied) > 0n ? unapplied : null
}

const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />

/** A5: the clinic and the receipt number at the top, the amount large, a line to sign. */
async function A5Receipt({ receipt, letterhead }: Props) {
  const t = await getTranslations("print")
  const tb = await getTranslations("billing")
  const format = await getFormatter()
  const credit = unappliedOf(receipt)

  return (
    <PaperSheet paper="A5">
      <FitPage paper="A5">
        <div className="flex min-h-[186mm] flex-col" data-testid="receipt">
          <header className="flex items-start justify-between gap-4 border-b-[3px] border-double border-black pb-3">
            <div className="flex items-center gap-3">
              {letterhead.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- printed as is, no resizing
                <img
                  src={letterhead.logoUrl}
                  alt=""
                  className="max-h-[16mm] max-w-[24mm] object-contain"
                />
              )}
              <div>
                <p className="text-[1.25em] font-bold">{letterhead.name}</p>
                {letterhead.address && <p>{letterhead.address}</p>}
                {letterhead.phone && (
                  <p>
                    <bdi>{formatLocalPhone(letterhead.phone)}</bdi>
                  </p>
                )}
              </div>
            </div>
            <div className="text-end">
              <p className="text-[1.3em] font-bold">{t("receiptTitle")}</p>
              <p className="font-semibold">
                <bdi>{receipt.number}</bdi>
              </p>
              <p>
                {format.dateTime(receipt.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: letterhead.timezone,
                })}
              </p>
            </div>
          </header>

          {receipt.voidedAt && (
            <p className="mt-3 border-2 border-black p-1.5 text-center text-[1.1em] font-bold">
              {t("voided", { reason: receipt.voidReason ?? "" })}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-black px-3 py-2">
            <div className="col-span-2 min-w-0">
              <dt className="text-[0.8em] text-slate-600">{t("patient")}</dt>
              <dd className="truncate font-semibold">{receipt.patient.fullName}</dd>
            </div>
            <div>
              <dt className="text-[0.8em] text-slate-600">{t("code")}</dt>
              <dd className="font-semibold">
                <bdi>{receipt.patient.code}</bdi>
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-md border-2 border-black px-4 py-3 text-center">
            <p className="text-slate-700">{t("amountReceived")}</p>
            <p className="text-[2em] leading-tight font-bold" data-testid="receipt-amount">
              {money(receipt.amount)}
            </p>
            <p>
              {tb(`methods.${receipt.method}`)}
              {receipt.reference && (
                <span className="ms-1">
                  (<bdi>{receipt.reference}</bdi>)
                </span>
              )}
            </p>
          </div>

          {(receipt.appliedTo.length > 0 || credit) && (
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b border-black text-[0.85em]">
                  <th className="py-1 text-start font-semibold">{t("appliedTo")}</th>
                  <th className="py-1 text-end font-semibold">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.appliedTo.map((a) => (
                  <tr key={a.number} className="border-b border-dotted border-slate-400">
                    <td className="py-1">
                      <bdi>{a.number}</bdi>
                    </td>
                    <td className="py-1 text-end">{money(a.amount)}</td>
                  </tr>
                ))}
                {credit && (
                  <tr className="border-b border-dotted border-slate-400">
                    <td className="py-1">{t("credit")}</td>
                    <td className="py-1 text-end">{money(credit)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="mt-3 flex items-baseline justify-between border-t-2 border-black pt-2 text-[1.1em] font-bold">
            <span>{receipt.account.owes ? t("balanceDue") : t("creditBalance")}</span>
            <span>
              {money(receipt.account.owes ? receipt.account.balance : receipt.account.credit)}
            </span>
          </div>
          {receipt.notes && <p className="mt-2">{receipt.notes}</p>}

          <div className="mt-auto flex items-end justify-between gap-6 pt-8">
            <div>
              {receipt.receivedByName && (
                <p>
                  {t("receivedBy")}: <span className="font-semibold">{receipt.receivedByName}</span>
                </p>
              )}
            </div>
            <div className="w-[48mm] border-t border-black pt-1 text-center">{t("signature")}</div>
          </div>

          {letterhead.footer && (
            <footer className="mt-4 border-t-2 border-black pt-1.5 text-center text-[0.85em] whitespace-pre-line">
              {letterhead.footer}
            </footer>
          )}
        </div>
      </FitPage>
    </PaperSheet>
  )
}

/** 80 mm receipt printer slip. */
async function ThermalReceipt({ receipt, letterhead }: Props) {
  const t = await getTranslations("print")
  const tb = await getTranslations("billing")
  const format = await getFormatter()
  const credit = unappliedOf(receipt)

  return (
    <ThermalSheet>
      {letterhead.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- printed as is, no resizing
        <img
          src={letterhead.logoUrl}
          alt=""
          className="mx-auto mb-1 max-h-[14mm] max-w-[40mm] object-contain grayscale"
        />
      )}
      <LetterheadBlock letterhead={letterhead} />
      <Rule />
      <div className="text-center">
        <p className="text-sm font-bold">{t("receiptTitle")}</p>
        <p>
          <bdi>{receipt.number}</bdi>
        </p>
      </div>
      {receipt.voidedAt && (
        <p className="my-2 border-2 border-black p-1 text-center text-sm font-bold">
          {t("voided", { reason: receipt.voidReason ?? "" })}
        </p>
      )}
      <Rule />
      <Row label={t("date")}>
        {format.dateTime(receipt.createdAt, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: letterhead.timezone,
        })}
      </Row>
      <Row label={t("patient")}>{receipt.patient.fullName}</Row>
      <Row label={t("code")}>
        <bdi>{receipt.patient.code}</bdi>
      </Row>
      <Rule />
      <div className="text-center">
        <p>{t("amountReceived")}</p>
        <p className="text-xl font-bold" data-testid="receipt-amount">
          {money(receipt.amount)}
        </p>
        <p>
          {tb(`methods.${receipt.method}`)}
          {receipt.reference && (
            <span className="ms-1">
              (<bdi>{receipt.reference}</bdi>)
            </span>
          )}
        </p>
      </div>
      {(receipt.appliedTo.length > 0 || credit) && (
        <>
          <Rule />
          <p className="font-bold">{t("appliedTo")}</p>
          {receipt.appliedTo.map((a) => (
            <Row key={a.number} label={<bdi>{a.number}</bdi>}>
              {money(a.amount)}
            </Row>
          ))}
          {credit && <Row label={t("credit")}>{money(credit)}</Row>}
        </>
      )}
      <Rule />
      <Row label={receipt.account.owes ? t("balanceDue") : t("creditBalance")} strong>
        {money(receipt.account.owes ? receipt.account.balance : receipt.account.credit)}
      </Row>
      {receipt.receivedByName && <Row label={t("receivedBy")}>{receipt.receivedByName}</Row>}
      {receipt.notes && <p className="mt-1">{receipt.notes}</p>}
      {/* One closing line: the clinic's own footer, or a thank-you when it has none. */}
      <Rule />
      <p className="text-center whitespace-pre-line">{letterhead.footer ?? t("thanks")}</p>
    </ThermalSheet>
  )
}

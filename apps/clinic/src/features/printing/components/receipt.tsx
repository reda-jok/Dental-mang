import { getFormatter, getTranslations } from "next-intl/server"

import type { PaymentReceipt } from "@/features/billing/data"
import { sumAmounts } from "@/features/billing/payments"
import type { Letterhead } from "@/features/settings/data"
import { formatMoney, subtractAmounts, toMinor } from "@/lib/money"

import { Amount, LetterheadBlock, Row, Rule, ThermalSheet } from "./sheets"

/** Payment receipt on 80 mm thermal paper. */
export async function Receipt({
  receipt,
  letterhead,
}: {
  receipt: PaymentReceipt
  letterhead: Letterhead
}) {
  const t = await getTranslations("print")
  const tb = await getTranslations("billing")
  const format = await getFormatter()
  const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />
  // Part of the payment not applied to an invoice stays as the patient's credit.
  const unapplied = subtractAmounts(
    receipt.amount,
    sumAmounts(receipt.appliedTo.map((a) => a.amount)),
  )
  const hasCredit = toMinor(unapplied) > 0n

  return (
    <ThermalSheet>
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
      {(receipt.appliedTo.length > 0 || hasCredit) && (
        <>
          <Rule />
          <p className="font-bold">{t("appliedTo")}</p>
          {receipt.appliedTo.map((a) => (
            <Row key={a.number} label={<bdi>{a.number}</bdi>}>
              {money(a.amount)}
            </Row>
          ))}
          {hasCredit && <Row label={t("credit")}>{money(unapplied)}</Row>}
        </>
      )}
      <Rule />
      <Row label={receipt.account.owes ? t("balanceDue") : t("creditBalance")} strong>
        {money(receipt.account.owes ? receipt.account.balance : receipt.account.credit)}
      </Row>
      {receipt.receivedByName && <Row label={t("receivedBy")}>{receipt.receivedByName}</Row>}
      {receipt.notes && <p className="mt-1">{receipt.notes}</p>}
      <Rule />
      {letterhead.footer && <p className="text-center whitespace-pre-line">{letterhead.footer}</p>}
      <p className="mt-1 text-center">{t("thanks")}</p>
    </ThermalSheet>
  )
}

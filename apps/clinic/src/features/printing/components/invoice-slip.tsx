import { getFormatter, getTranslations } from "next-intl/server"

import type { InvoiceDetail } from "@/features/billing/data"
import { toothText } from "@/features/billing/display"
import type { Letterhead } from "@/features/settings/data"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"

import { Amount, LetterheadBlock, Row, Rule, ThermalSheet } from "./sheets"

/** An invoice on 80 mm thermal paper: what was done, the total, and what's left to pay. */
export async function InvoiceSlip({
  invoice,
  letterhead,
}: {
  invoice: InvoiceDetail
  letterhead: Letterhead
}) {
  const t = await getTranslations("print")
  const tb = await getTranslations("billing")
  const format = await getFormatter()
  const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { dateStyle: "medium", timeZone: "UTC" })

  return (
    <ThermalSheet>
      <LetterheadBlock letterhead={letterhead} />
      <Rule />
      <div className="text-center">
        <p className="text-sm font-bold">{t("invoiceTitle")}</p>
        <p>
          <bdi>{invoice.number}</bdi>
        </p>
      </div>
      {invoice.status === "void" && (
        <p className="my-2 border-2 border-black p-1 text-center text-sm font-bold">
          {t("voided", { reason: invoice.voidReason ?? "" })}
        </p>
      )}
      <Rule />
      <Row label={t("date")}>{day(invoice.issueDate)}</Row>
      <Row label={t("patient")}>{invoice.patient.fullName}</Row>
      <Row label={t("code")}>
        <bdi>{invoice.patient.code}</bdi>
      </Row>
      <Rule />
      <ul className="space-y-1.5">
        {invoice.lines.map((line) => {
          const tooth = toothText(line.tooth, line.surfaces)
          return (
            <li key={line.id}>
              <Row label={line.description}>{money(line.total)}</Row>
              <p className="text-[11px]">
                {tooth && `${tb("toothLabel", { tooth })} · `}
                {line.quantity > 1 && (
                  <>
                    <bdi>{`${line.quantity} × ${formatMoney(line.unitPrice, "IQD")}`}</bdi>
                    {" · "}
                  </>
                )}
                {line.discount !== "0" &&
                  t("lineDiscount", { amount: formatMoney(line.discount, "IQD") })}
              </p>
            </li>
          )
        })}
      </ul>
      <Rule />
      <Row label={tb("subtotal")}>{money(invoice.subtotal)}</Row>
      {invoice.discountTotal !== "0" && (
        <Row label={tb("discounts")}>{money(invoice.discountTotal)}</Row>
      )}
      <Row label={tb("total")} strong>
        {money(invoice.total)}
      </Row>
      {invoice.status === "issued" && (
        <>
          <Row label={tb("paid")}>{money(invoice.paid)}</Row>
          <Row label={tb("balance")} strong>
            {money(invoice.balance)}
          </Row>
          {invoice.balance !== "0" && <Row label={tb("dueDate")}>{day(invoice.dueDate)}</Row>}
        </>
      )}
      <Rule />
      {letterhead.footer && <p className="text-center whitespace-pre-line">{letterhead.footer}</p>}
      <p className="mt-1 text-center">{t("thanks")}</p>
    </ThermalSheet>
  )
}

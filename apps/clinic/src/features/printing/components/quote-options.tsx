import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

import {
  COPIES,
  DEPOSIT_PERCENTS,
  INSTALLMENT_MONTHS,
  PAYMENT_MODES,
  type PaymentMode,
} from "../quote"

const SELECT =
  "border-input h-9 rounded-md border bg-white px-2 text-sm focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"

/**
 * What to print, chosen on screen (never printed). A plain GET form: the choice lives in
 * the address only, nothing is saved.
 */
export async function QuoteOptions({
  copies,
  pay,
  months,
  deposit,
}: {
  copies: (typeof COPIES)[number]
  pay: PaymentMode
  months: number
  deposit: number
}) {
  const t = await getTranslations("print.options")
  const field = (id: string, label: string, control: ReactNode) => (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {control}
    </label>
  )
  return (
    <form
      method="get"
      className="mx-auto mb-4 flex max-w-3xl flex-wrap items-end justify-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm print:hidden"
      aria-label={t("title")}
    >
      {field(
        "copies",
        t("copies"),
        <select id="copies" name="copies" defaultValue={copies} className={SELECT}>
          {COPIES.map((c) => (
            <option key={c} value={c}>
              {t(`copiesOptions.${c}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        "pay",
        t("pay"),
        <select id="pay" name="pay" defaultValue={pay} className={SELECT}>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {t(`payModes.${m}`)}
            </option>
          ))}
        </select>,
      )}
      {field(
        "months",
        t("months"),
        <select id="months" name="months" defaultValue={String(months)} className={SELECT}>
          {INSTALLMENT_MONTHS.map((m) => (
            <option key={m} value={m}>
              {t("monthsOption", { count: m })}
            </option>
          ))}
        </select>,
      )}
      {field(
        "deposit",
        t("deposit"),
        <select id="deposit" name="deposit" defaultValue={String(deposit)} className={SELECT}>
          {DEPOSIT_PERCENTS.map((d) => (
            <option key={d} value={d}>
              {d === 0 ? t("noDeposit") : t("depositOption", { percent: String(d) })}
            </option>
          ))}
        </select>,
      )}
      <Button type="submit" variant="outline">
        {t("apply")}
      </Button>
      <p className="w-full text-center text-xs text-slate-500">{t("hint")}</p>
    </form>
  )
}

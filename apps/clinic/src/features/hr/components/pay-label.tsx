import { getTranslations } from "next-intl/server"

import { formatMoney } from "@/lib/money"

import type { PayVersion } from "../commission"

/** "عمولة 30٪", "راتب 750,000 د.ع. + عمولة 20٪", or "not set yet". */
export async function PayLabel({ pay }: { pay: PayVersion | null }) {
  const t = await getTranslations("hr")
  if (!pay) return <span className="text-amber-700">{t("payNotSet")}</span>
  const rate = pay.commissionRate.replace(/\.00$/, "")
  const salary = formatMoney(pay.monthlySalary ?? "0", "IQD")
  return (
    <span>
      {pay.payType === "commission" && t("payCommission", { rate })}
      {pay.payType === "salary" && t("paySalary", { salary })}
      {pay.payType === "both" && t("payBoth", { salary, rate })}
      {pay.payType !== "salary" && !pay.deductLab && (
        <span className="block text-xs text-slate-500">{t("labNotDeducted")}</span>
      )}
    </span>
  )
}

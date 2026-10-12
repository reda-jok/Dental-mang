import { CoinsIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { MonthNav } from "@/features/hr/components/month-nav"
import { PayDialog } from "@/features/hr/components/pay-dialog"
import { PayLabel } from "@/features/hr/components/pay-label"
import { currentMonth, getCommissionReport } from "@/features/hr/data"
import { monthParams } from "@/features/hr/schemas"
import { Amount } from "@/features/printing/components/sheets"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hr")
  return { title: t("title") }
}

const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />

export default async function HrPage({ searchParams }: PageProps<"/hr/commission">) {
  const user = await requirePagePermission("hr:self")
  const thisMonth = currentMonth()
  const { month = thisMonth } = monthParams.parse(await searchParams)
  const [report, t] = await Promise.all([getCommissionReport(month), getTranslations("hr")])
  const canPay = hasPermission(user, "hr:pay")

  return (
    <Panel
      icon={CoinsIcon}
      title={report.all ? t("reportTitle") : t("ownTitle")}
      description={t("reportDescription")}
      actions={<MonthNav path="/hr/commission" month={month} />}
    >
      {report.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t("noDentists")}</p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm" data-testid="commission">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2 text-start font-medium">{t("dentist")}</th>
                <th className="py-2 text-start font-medium">{t("pay")}</th>
                <th className="py-2 text-end font-medium">{t("collected")}</th>
                <th className="py-2 text-end font-medium">{t("lab")}</th>
                <th className="py-2 text-end font-medium">{t("commission")}</th>
                <th className="py-2 text-end font-medium">{t("total")}</th>
                {canPay && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row) => (
                <tr key={row.dentist.id} data-dentist={row.dentist.id}>
                  <td className="py-3 font-medium">
                    <Link
                      href={`/hr/commission/${row.dentist.id}?month=${month}` as Route}
                      className="hover:underline"
                    >
                      {row.dentist.name}
                    </Link>
                    {row.dentist.banned && (
                      <span className="ms-2 text-xs text-slate-500">{t("former")}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <PayLabel pay={row.pay} />
                  </td>
                  <td className="py-3 text-end">{money(row.collected)}</td>
                  <td className="py-3 text-end text-slate-600">{money(row.lab)}</td>
                  <td className="py-3 text-end font-medium" data-testid="commission-amount">
                    {money(row.commission)}
                  </td>
                  <td className="py-3 text-end font-semibold">{money(row.total)}</td>
                  {canPay && (
                    <td className="py-3">
                      <PayDialog dentist={row.dentist} pay={row.pay} currentMonth={thisMonth} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

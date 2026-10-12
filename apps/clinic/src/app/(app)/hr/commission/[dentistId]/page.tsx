import { ClipboardListIcon, CoinsIcon, HistoryIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"

import { Panel } from "@/components/panel"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { MonthNav } from "@/features/hr/components/month-nav"
import { PayLabel } from "@/features/hr/components/pay-label"
import { currentMonth, getDentistCommission } from "@/features/hr/data"
import { monthParams } from "@/features/hr/schemas"
import { Amount } from "@/features/printing/components/sheets"
import { formatMoney } from "@/lib/money"
import { AppError } from "@/server/errors"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hr")
  return { title: t("title") }
}

const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />

export default async function DentistCommissionPage({
  params,
  searchParams,
}: PageProps<"/hr/commission/[dentistId]">) {
  await requirePagePermission("hr:self")
  const { dentistId } = await params
  if (!z.uuid().safeParse(dentistId).success) notFound()
  const { month = currentMonth() } = monthParams.parse(await searchParams)
  const data = await getDentistCommission(dentistId, month).catch((e) => {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound()
    throw e
  })
  const [t, format] = await Promise.all([getTranslations("hr"), getFormatter()])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{data.dentist.name}</h2>
          <p className="text-sm text-slate-500">
            <PayLabel pay={data.pay} />
          </p>
        </div>
        <MonthNav path={`/hr/commission/${data.dentist.id}`} month={month} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title={t("collected")}
          value={money(data.collected)}
          icon={CoinsIcon}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title={t("lab")}
          value={money(data.lab)}
          icon={CoinsIcon}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <StatCard
          title={t("commission")}
          value={<span data-testid="commission-amount">{money(data.commission)}</span>}
          icon={CoinsIcon}
          iconClassName="bg-blue-50 text-blue-600"
          note={t("baseNote", { base: formatMoney(data.base, "IQD") })}
        />
        <StatCard
          title={t("total")}
          value={money(data.total)}
          icon={CoinsIcon}
          iconClassName="bg-amber-50 text-amber-600"
          note={
            data.salary === "0"
              ? undefined
              : t("salaryNote", { salary: formatMoney(data.salary, "IQD") })
          }
        />
      </div>

      <Panel icon={ClipboardListIcon} title={t("linesTitle")} description={t("linesDescription")}>
        {data.lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("noLines")}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm" data-testid="commission-lines">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-start font-medium">{t("patient")}</th>
                  <th className="py-2 text-start font-medium">{t("treatment")}</th>
                  <th className="py-2 text-end font-medium">{t("collected")}</th>
                  <th className="py-2 text-end font-medium">{t("lab")}</th>
                  <th className="py-2 text-end font-medium">{t("base")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lines.map((line) => (
                  <tr key={line.lineId}>
                    <td className="py-2">
                      {line.patient.fullName}
                      <span className="ms-2 text-xs text-slate-500">
                        <bdi>{line.invoiceNumber}</bdi>
                      </span>
                    </td>
                    <td className="py-2">
                      {line.description}
                      {line.tooth !== null && (
                        <span className="ms-2 text-xs text-slate-500">
                          <bdi>{line.tooth}</bdi>
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-end">{money(line.collected)}</td>
                    <td className="py-2 text-end text-slate-600">{money(line.lab)}</td>
                    <td className="py-2 text-end font-medium">{money(line.base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel icon={HistoryIcon} title={t("historyTitle")}>
        {data.history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">{t("payNotSet")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.history.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-2">
                <PayLabel pay={v} />
                <span className="text-slate-500">
                  {t("fromMonth", {
                    month: format.dateTime(new Date(`${v.effectiveFrom}-01T00:00:00Z`), {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }),
                    name: v.createdByName ?? "—",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Link
        href={`/hr/commission?month=${month}` as Route}
        className="text-primary text-sm hover:underline"
      >
        {t("backToReport")}
      </Link>
    </div>
  )
}

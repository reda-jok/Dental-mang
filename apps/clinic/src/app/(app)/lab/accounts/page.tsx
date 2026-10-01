import { FileTextIcon, HandCoinsIcon, PackageCheckIcon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getFormatter, getTranslations } from "next-intl/server"

import { IconButton } from "@/components/icon-button"
import { Panel } from "@/components/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { LabPaymentButton } from "@/features/lab/components/lab-money"
import { getLabAccounts } from "@/features/lab/data"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lab")
  return { title: t("tabs.accounts") }
}

export default async function LabAccountsPage() {
  await requirePagePermission("lab:pay")
  const [accounts, t, format] = await Promise.all([
    getLabAccounts(),
    getTranslations("lab"),
    getFormatter(),
  ])
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>
  const owedCell = (owed: string) => {
    const minor = toMinor(owed)
    if (minor === 0n) return <span className="text-slate-500">{t("accounts.settled")}</span>
    if (minor < 0n)
      return (
        <span className="text-blue-700">
          {t("accounts.credit", { amount: formatMoney(owed.slice(1), "IQD") })}
        </span>
      )
    return <span className="font-semibold text-slate-900">{money(owed)}</span>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={t("accounts.stats.owed")}
          value={money(accounts.totals.owed)}
          icon={HandCoinsIcon}
          iconClassName="bg-red-50 text-red-600"
          note={t("accounts.stats.owedNote")}
        />
        <StatCard
          title={t("accounts.stats.billedMonth")}
          value={money(accounts.totals.billedThisMonth)}
          icon={PackageCheckIcon}
          iconClassName="bg-purple-50 text-purple-600"
          note={t("accounts.stats.billedMonthNote")}
        />
        <StatCard
          title={t("accounts.stats.paidMonth")}
          value={money(accounts.totals.paidThisMonth)}
          icon={WalletIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("accounts.stats.paidMonthNote")}
        />
      </div>

      <Panel
        icon={HandCoinsIcon}
        title={t("tabs.accounts")}
        description={t("accounts.description")}
        className="min-w-0"
        contentClassName="p-0"
      >
        {accounts.rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">{t("accounts.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">{t("accounts.columns.lab")}</TableHead>
                  <TableHead className="text-end">{t("accounts.columns.owed")}</TableHead>
                  <TableHead className="text-end">{t("accounts.columns.billedMonth")}</TableHead>
                  <TableHead className="text-end">{t("accounts.columns.paidMonth")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("accounts.columns.lastPaid")}
                  </TableHead>
                  <TableHead className="pe-6 text-end">{t("accounts.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.rows.map((lab) => (
                  <TableRow
                    key={lab.id}
                    data-lab-account={lab.name}
                    className={cn(lab.archivedAt && "opacity-60")}
                  >
                    <TableCell className="ps-6">
                      <Link
                        href={`/lab/accounts/${lab.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {lab.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap" data-owed>
                      {owedCell(lab.owed)}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {money(lab.billedThisMonth)}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {money(lab.paidThisMonth)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-slate-600 md:table-cell">
                      {lab.lastPaidOn
                        ? format.dateTime(parseIsoDate(lab.lastPaidOn)!, {
                            day: "numeric",
                            month: "long",
                            timeZone: "UTC",
                          })
                        : t("accounts.neverPaid")}
                    </TableCell>
                    <TableCell className="pe-6">
                      <span className="flex justify-end gap-1">
                        <LabPaymentButton lab={lab} owed={lab.owed} compact />
                        <IconButton label={t("accounts.statementOf", { name: lab.name })} asChild>
                          <Link href={`/lab/accounts/${lab.id}`}>
                            <FileTextIcon />
                          </Link>
                        </IconButton>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  )
}

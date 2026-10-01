import {
  BanknoteIcon,
  CheckCircle2Icon,
  CreditCardIcon,
  HistoryIcon,
  LockKeyholeIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CashCloseForm } from "@/features/billing/components/cash-close-form"
import { getCashDrawer } from "@/features/billing/data"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing")
  return { title: t("tabs.cash") }
}

export default async function CashPage() {
  await requirePagePermission("billing:write")
  const [drawer, t, format] = await Promise.all([
    getCashDrawer(),
    getTranslations("billing"),
    getFormatter(),
  ])
  const { summary, movements } = drawer.open
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>
  const day = (iso: string, style: "full" | "short" = "short") =>
    format.dateTime(
      parseIsoDate(iso)!,
      style === "full"
        ? { dateStyle: "full", timeZone: "UTC" }
        : { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" },
    )
  const time = (at: Date) => format.dateTime(at, { hour: "numeric", minute: "2-digit" })
  const differenceText = (difference: string) =>
    difference === "0"
      ? t("outcome.match")
      : t(difference.startsWith("-") ? "outcome.short" : "outcome.over", {
          amount: formatMoney(difference.replace("-", ""), "IQD"),
        })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("cashIn")}
          value={money(summary.cashIn)}
          icon={BanknoteIcon}
          iconClassName="bg-green-50 text-green-600"
          note={t("paymentsCount", { count: summary.counts.cashIn })}
        />
        <StatCard
          title={t("cashOut")}
          value={money(summary.cashOut)}
          icon={Undo2Icon}
          iconClassName="bg-red-50 text-red-600"
          note={t("cashOutNote", { count: summary.counts.cashOut })}
        />
        <StatCard
          title={t("cardIn")}
          value={money(summary.card)}
          icon={CreditCardIcon}
          iconClassName="bg-blue-50 text-blue-600"
          note={t("cardNote", { count: summary.counts.card })}
        />
        <StatCard
          title={t("walletIn")}
          value={money(summary.wallet)}
          icon={SmartphoneIcon}
          iconClassName="bg-purple-50 text-purple-600"
          note={t("walletNote", { count: summary.counts.wallet })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel
          icon={LockKeyholeIcon}
          title={
            drawer.todayClose
              ? t("todayClosed")
              : t("closeToday", { day: day(drawer.today, "full") })
          }
          description={drawer.todayClose ? undefined : t("closeTodayDescription")}
          className="min-w-0 xl:col-span-2"
        >
          {drawer.todayClose ? (
            <div className="space-y-3" data-closed-today>
              <p
                className={cn(
                  "flex items-center gap-2 rounded-lg p-3 font-medium",
                  drawer.todayClose.difference === "0"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700",
                )}
              >
                {drawer.todayClose.difference === "0" ? (
                  <CheckCircle2Icon className="size-4" aria-hidden />
                ) : (
                  <TriangleAlertIcon className="size-4" aria-hidden />
                )}
                {differenceText(drawer.todayClose.difference)}
              </p>
              <p className="text-sm text-slate-600">
                {t("closedBy", {
                  name: drawer.todayClose.closedByName ?? "—",
                  time: time(drawer.todayClose.closedAt),
                })}
              </p>
              {movements.length > 0 && (
                <p className="text-sm text-blue-700">
                  {t("afterClose", {
                    count: movements.length,
                    amount: formatMoney(summary.expected, "IQD"),
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-600">{t("expected")}</p>
                <p className="text-3xl font-bold text-slate-900" data-testid="expected-cash">
                  {money(summary.expected)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t("expectedHint")}</p>
              </div>
              <CashCloseForm expected={summary.expected} />
            </div>
          )}
        </Panel>

        <Panel
          icon={HistoryIcon}
          title={t("monthTitle")}
          description={t("monthDescription", { count: drawer.month.closes })}
          className="min-w-0"
        >
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt>{t("monthShort", { count: drawer.month.short.count })}</dt>
              <dd className="font-medium text-red-700">{money(drawer.month.short.amount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{t("monthOver", { count: drawer.month.over.count })}</dt>
              <dd className="font-medium text-blue-700">{money(drawer.month.over.amount)}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {movements.length > 0 && (
        <Panel
          icon={BanknoteIcon}
          title={drawer.todayClose ? t("movementsAfterClose") : t("movementsTitle")}
          className="min-w-0"
          contentClassName="p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">{t("movementColumns.number")}</TableHead>
                  <TableHead>{t("movementColumns.patient")}</TableHead>
                  <TableHead>{t("movementColumns.kind")}</TableHead>
                  <TableHead className="text-end">{t("movementColumns.amount")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("movementColumns.time")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={`${m.kind}-${m.sourceId}`} data-movement={m.number}>
                    <TableCell className="ps-6">
                      <bdi className="font-mono text-sm">{m.number}</bdi>
                    </TableCell>
                    <TableCell>{m.patientName}</TableCell>
                    <TableCell>
                      {t(`movementKinds.${m.kind}`)} · {t(`methods.${m.method}`)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-end font-medium whitespace-nowrap",
                        m.kind === "payment" ? "text-green-700" : "text-red-700",
                      )}
                    >
                      {m.kind === "payment" ? "+" : "−"}
                      {money(m.amount)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-slate-500 sm:table-cell">
                      {format.dateTime(m.at, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      <Panel
        icon={HistoryIcon}
        title={t("historyTitle")}
        className="min-w-0"
        contentClassName="p-0"
      >
        {drawer.history.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">{t("historyEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-6">{t("historyColumns.day")}</TableHead>
                  <TableHead className="text-end">{t("historyColumns.expected")}</TableHead>
                  <TableHead className="text-end">{t("historyColumns.counted")}</TableHead>
                  <TableHead>{t("historyColumns.difference")}</TableHead>
                  <TableHead className="hidden text-end md:table-cell">
                    {t("historyColumns.card")}
                  </TableHead>
                  <TableHead className="hidden text-end md:table-cell">
                    {t("historyColumns.wallet")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">{t("historyColumns.by")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawer.history.map((c) => (
                  <TableRow key={c.id} data-close={c.day}>
                    <TableCell className="ps-6 whitespace-nowrap">{day(c.day)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {money(c.expected)}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">{money(c.counted)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          c.difference === "0"
                            ? "text-green-700"
                            : toMinor(c.difference) < 0n
                              ? "text-red-700"
                              : "text-blue-700",
                        )}
                      >
                        {differenceText(c.difference)}
                      </span>
                      {c.notes && (
                        <p className="max-w-56 truncate text-xs text-slate-500">{c.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-end whitespace-nowrap md:table-cell">
                      {money(c.card)}
                    </TableCell>
                    <TableCell className="hidden text-end whitespace-nowrap md:table-cell">
                      {money(c.wallet)}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {c.closedByName ?? "—"}
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

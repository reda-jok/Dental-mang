import { ChartColumnIcon, TrendingUpIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { InfoHint } from "@/components/info-hint"
import { Panel } from "@/components/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProfitBars } from "@/features/accounting/components/profit-bars"
import { getProfitAndLoss } from "@/features/accounting/data"
import { reportParams } from "@/features/accounting/schemas"
import { MonthNav } from "@/features/hr/components/month-nav"
import { formatMoney, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounting.pnl")
  return { title: t("title") }
}

/** "750000" → "-750000" (exact, on the string): costs are shown taken away. */
const negate = (v: string) => (v === "0" ? v : v.startsWith("-") ? v.slice(1) : `-${v}`)
const abs = (v: string) => v.replace(/^-/, "")

export default async function ProfitPage({ searchParams }: PageProps<"/accounting/profit">) {
  await requirePagePermission("accounting:reports")
  const { month } = reportParams.parse(await searchParams)
  const [pnl, t, format] = await Promise.all([
    getProfitAndLoss(month),
    getTranslations("accounting.pnl"),
    getFormatter(),
  ])
  const now = pnl.months.length - 1
  const before = now - 1
  const monthName = (m: string, style: "long" | "short" = "long") =>
    format.dateTime(new Date(`${m}-01T00:00:00Z`), {
      month: style,
      ...(style === "long" && { year: "numeric" }),
      timeZone: "UTC",
    })
  const money = (v: string) => <bdi>{formatMoney(v, "IQD")}</bdi>
  const nothing = [pnl.revenue, pnl.collected, ...pnl.costs.map((c) => c.amounts)]
    .flat()
    .every((v) => v === "0")

  const line = (
    key: string,
    label: ReactNode,
    values: string[],
    style: "plain" | "cost" | "total" | "profit" | "muted" = "plain",
  ) => {
    const shown = style === "cost" ? values.map(negate) : values
    return (
      <TableRow
        key={key}
        data-line={key}
        className={cn(
          (style === "total" || style === "profit") && "bg-muted/40 font-semibold",
          style === "muted" && "text-muted-foreground",
        )}
      >
        <TableCell className={cn("ps-4 whitespace-normal", style === "profit" && "text-base")}>
          <span className="inline-flex items-center gap-1">{label}</span>
        </TableCell>
        {[now, before].map((i) => (
          <TableCell
            key={i}
            data-month={i === now ? "current" : "previous"}
            className={cn(
              "text-end",
              i === before && "text-muted-foreground hidden sm:table-cell",
              style === "profit" && "text-base",
              style === "profit" && shown[i]!.startsWith("-") && "text-destructive",
            )}
          >
            {money(shown[i]!)}
          </TableCell>
        ))}
      </TableRow>
    )
  }

  const biggest = pnl.profit.reduce((max, p) => {
    const v = toMinor(abs(p))
    return v > max ? v : max
  }, 0n)

  return (
    <div className="space-y-6">
      <Panel
        icon={TrendingUpIcon}
        title={t("title")}
        description={t("description")}
        actions={<MonthNav path="/accounting/profit" month={pnl.month} />}
      >
        {nothing ? (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border">
            <Table data-testid="pnl">
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">{t("item")}</TableHead>
                  <TableHead className="w-0 text-end">{monthName(pnl.months[now]!)}</TableHead>
                  <TableHead className="text-muted-foreground hidden w-0 text-end sm:table-cell">
                    {monthName(pnl.months[before]!)}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {line("revenue", t("revenue"), pnl.revenue)}
                {line("discounts", t("discounts"), pnl.discounts, "cost")}
                {line("netRevenue", t("netRevenue"), pnl.netRevenue, "total")}
                {/* Costs of either month shown (the chart's other months have their own). */}
                {pnl.costs
                  .filter((c) => c.amounts[now] !== "0" || c.amounts[before] !== "0")
                  .map((c) =>
                    line(
                      c.key,
                      c.key === "dentistPay" ? (
                        <>
                          {t("dentistPay")}
                          <InfoHint>{t("dentistPayHint")}</InfoHint>
                        </>
                      ) : (
                        c.name
                      ),
                      c.amounts,
                      "cost",
                    ),
                  )}
                {line("totalCosts", t("totalCosts"), pnl.totalCosts, "total")}
                {line("profit", t("profit"), pnl.profit, "profit")}
                {line(
                  "collected",
                  <>
                    {t("collected")}
                    <InfoHint>{t("collectedHint")}</InfoHint>
                  </>,
                  pnl.collected,
                  "muted",
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel icon={ChartColumnIcon} title={t("trendTitle")}>
        <ProfitBars
          bars={pnl.months.map((m, i) => {
            const profit = pnl.profit[i]!
            return {
              month: m,
              name: monthName(m, "short"),
              label: t("trendBar", { month: monthName(m), amount: formatMoney(profit, "IQD") }),
              size: biggest === 0n ? 0 : Number((toMinor(abs(profit)) * 1000n) / biggest) / 1000,
              loss: profit.startsWith("-"),
            }
          })}
        />
      </Panel>
    </div>
  )
}

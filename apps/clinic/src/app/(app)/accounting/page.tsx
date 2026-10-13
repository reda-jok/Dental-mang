import { BanknoteIcon, ReceiptIcon, TrendingDownIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { FilterBar } from "@/components/filter-bar"
import { InfoHint } from "@/components/info-hint"
import { Panel } from "@/components/panel"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExpenseButton, ExpenseVoidButton } from "@/features/accounting/components/expense-form"
import { listExpenses } from "@/features/accounting/data"
import { EXPENSE_CATEGORIES } from "@/features/accounting/expenses"
import { expenseParams } from "@/features/accounting/schemas"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { MonthNav } from "@/features/hr/components/month-nav"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounting")
  return { title: t("title") }
}

export default async function AccountingPage({ searchParams }: PageProps<"/accounting">) {
  const user = await requirePagePermission("accounting:read")
  const params = expenseParams.parse(await searchParams)
  const [{ month, expenses, totals }, t, format] = await Promise.all([
    listExpenses(params),
    getTranslations("accounting"),
    getFormatter(),
  ])
  const canRecord = hasPermission(user, "accounting:expense")
  const money = (amount: string) => <bdi>{formatMoney(amount, "IQD")}</bdi>
  const categoryName = (c: string) =>
    (EXPENSE_CATEGORIES as readonly string[]).includes(c)
      ? t(`categories.${c as (typeof EXPENSE_CATEGORIES)[number]}`)
      : c
  const biggest = totals.byCategory[0]
  const filtered = !!(params.q || params.category)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title={t("monthTotal")}
          value={money(totals.total)}
          icon={ReceiptIcon}
          iconClassName="bg-red-50 text-red-600"
        />
        <StatCard
          title={t("fromDrawer")}
          value={money(totals.cash)}
          icon={BanknoteIcon}
          iconClassName="bg-amber-50 text-amber-600"
          note={t("fromDrawerNote")}
        />
        <StatCard
          title={t("biggest")}
          value={biggest ? categoryName(biggest.category) : "—"}
          icon={TrendingDownIcon}
          iconClassName="bg-slate-100 text-slate-600"
          note={biggest ? formatMoney(biggest.amount, "IQD") : undefined}
        />
      </div>

      <Panel
        icon={ReceiptIcon}
        title={t("expensesTitle")}
        description={t("expensesDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthNav path="/accounting" month={month} />
            {canRecord && <ExpenseButton />}
          </div>
        }
      >
        <div className="space-y-4">
          <FilterBar
            q={params.q ?? ""}
            placeholder={t("searchPlaceholder")}
            hint={t("searchHint")}
            filter={{
              param: "category",
              label: t("category"),
              value: params.category ?? "all",
              defaultValue: "all",
              options: [
                { value: "all", label: t("allCategories") },
                ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
              ],
            }}
            keep={{ month }}
          />
          {expenses.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {filtered ? t("emptyFiltered") : t("empty")}
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-xl border">
              <Table data-testid="expenses">
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden ps-4 md:table-cell">{t("columns.date")}</TableHead>
                    <TableHead className="ps-4 md:ps-2">{t("columns.description")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("columns.category")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("columns.method")}</TableHead>
                    <TableHead className="w-0 text-end">{t("columns.amount")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("columns.by")}</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">{t("actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => {
                    const day = format.dateTime(parseIsoDate(e.paidOn)!, {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })
                    return (
                      <TableRow
                        key={e.id}
                        data-expense={e.number}
                        className={cn(e.voided && "text-muted-foreground")}
                      >
                        <TableCell className="hidden ps-4 md:table-cell">
                          {day}
                          <span className="text-muted-foreground block text-xs">
                            <bdi>{e.number}</bdi>
                          </span>
                        </TableCell>
                        <TableCell className="ps-4 whitespace-normal md:min-w-48 md:ps-2">
                          <span className={cn(e.voided && "line-through")}>{e.description}</span>
                          {e.payee && (
                            <span className="text-muted-foreground block text-xs">{e.payee}</span>
                          )}
                          {/* Phones: the date, category and method under the description. */}
                          <span className="text-muted-foreground block text-xs md:hidden">
                            {day} · {categoryName(e.category ?? e.accountName)} ·{" "}
                            {t(`methods.${e.method}`)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {categoryName(e.category ?? e.accountName)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {t(`methods.${e.method}`)}
                          {e.reference && (
                            <span className="text-muted-foreground block text-xs">
                              <bdi>{e.reference}</bdi>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-end font-medium whitespace-nowrap">
                          {e.voided ? (
                            <span className="inline-flex items-center gap-1">
                              <Badge variant="secondary">{t("voidedBadge")}</Badge>
                              {e.voidReason && <InfoHint>{e.voidReason}</InfoHint>}
                              <span className="line-through">{money(e.amount)}</span>
                            </span>
                          ) : (
                            money(e.amount)
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                          {e.createdByName ?? "—"}
                        </TableCell>
                        <TableCell>
                          {canRecord && !e.voided && (
                            <ExpenseVoidButton id={e.id} number={e.number} />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

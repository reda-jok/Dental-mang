import { BookOpenTextIcon } from "lucide-react"
import type { Metadata, Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCashBook, type CashBookRow } from "@/features/accounting/data"
import { cashBookParams, MONEY_ACCOUNTS } from "@/features/accounting/schemas"
import { MonthNav } from "@/features/hr/components/month-nav"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accounting.cashBook")
  return { title: t("title") }
}

const KINDS = ["payment", "refund", "lab_payment", "expense", "cash_close"] as const

export default async function CashBookPage({ searchParams }: PageProps<"/accounting/cash-book">) {
  await requirePagePermission("accounting:reports")
  const { month, account } = cashBookParams.parse(await searchParams)
  const [book, t, format] = await Promise.all([
    getCashBook(account, month),
    getTranslations("accounting.cashBook"),
    getFormatter(),
  ])
  const money = (v: string) => <bdi>{formatMoney(v, "IQD")}</bdi>
  const day = (iso: string) =>
    format.dateTime(parseIsoDate(iso)!, { day: "numeric", month: "short", timeZone: "UTC" })
  const kind = (row: CashBookRow) => {
    const name = (KINDS as readonly string[]).includes(row.source)
      ? t(`kinds.${row.source as (typeof KINDS)[number]}`)
      : t("kinds.other")
    return row.reversal ? t("voidOf", { kind: name }) : name
  }
  const isIn = (row: CashBookRow) => toMinor(row.debit) > 0n

  return (
    <Panel
      icon={BookOpenTextIcon}
      title={t("title")}
      description={t("description")}
      actions={<MonthNav path="/accounting/cash-book" month={book.month} keep={{ account }} />}
    >
      <div className="space-y-4">
        <nav aria-label={t("account")} className="flex flex-wrap gap-2">
          {MONEY_ACCOUNTS.map((a) => {
            const on = a === account
            return (
              <Link
                key={a}
                href={`/accounting/cash-book?account=${a}&month=${book.month}` as Route}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                  on
                    ? "border-primary bg-accent ring-primary text-primary ring-1"
                    : "bg-card hover:bg-muted",
                )}
              >
                {t(`accounts.${a}`)}
              </Link>
            )
          })}
        </nav>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="cash-book-totals">
          {(
            [
              ["opening", book.opening],
              ["moneyIn", book.moneyIn],
              ["moneyOut", book.moneyOut],
              ["closing", book.closing],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="bg-muted/40 rounded-xl border p-3" data-total={key}>
              <dt className="text-muted-foreground text-xs">{t(key)}</dt>
              <dd className="mt-1 font-semibold">{money(value)}</dd>
            </div>
          ))}
        </dl>

        {book.rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-xl border">
            <Table data-testid="cash-book">
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden ps-4 md:table-cell">{t("columns.date")}</TableHead>
                  <TableHead className="ps-4 md:ps-2">{t("columns.movement")}</TableHead>
                  <TableHead className="hidden w-0 text-end md:table-cell">
                    {t("columns.in")}
                  </TableHead>
                  <TableHead className="hidden w-0 text-end md:table-cell">
                    {t("columns.out")}
                  </TableHead>
                  <TableHead className="w-0 text-end">{t("columns.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {book.rows.map((row) => (
                  <TableRow key={row.id} data-movement={row.number ?? row.source}>
                    <TableCell className="hidden ps-4 md:table-cell">{day(row.date)}</TableCell>
                    <TableCell className="ps-4 whitespace-normal md:ps-2">
                      <span className="font-medium">{kind(row)}</span>
                      {row.number && (
                        <span className="text-muted-foreground ms-2 text-xs">
                          <bdi>{row.number}</bdi>
                        </span>
                      )}
                      {row.party && (
                        <span className="text-muted-foreground block text-xs">{row.party}</span>
                      )}
                      {/* Phones: the date and the signed amount here, the balance beside. */}
                      <span className="block text-xs md:hidden">
                        <span className="text-muted-foreground">{day(row.date)} · </span>
                        <span className={cn("font-medium", !isIn(row) && "text-destructive")}>
                          {isIn(row) ? money(row.debit) : money(`-${row.credit}`)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-end md:table-cell">
                      {isIn(row) && money(row.debit)}
                    </TableCell>
                    <TableCell className="text-destructive hidden text-end md:table-cell">
                      {!isIn(row) && money(row.credit)}
                    </TableCell>
                    <TableCell className="text-end font-medium">{money(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Panel>
  )
}

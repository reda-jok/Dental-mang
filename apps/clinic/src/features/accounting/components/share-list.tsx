import { formatMoney } from "@/lib/money"

type Row = {
  key: string
  label: string
  amount: string
  percent: string
  bar: number
  /** Shown before the amount, e.g. how many treatments it was. */
  detail?: string
}

/** Amounts as a bar list: one colour, the exact amount and its share as text beside each bar. */
export function ShareList({ rows, empty, testId }: { rows: Row[]; empty: string; testId: string }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{empty}</p>
  }
  return (
    <ol className="space-y-3" data-testid={testId}>
      {rows.map((row) => (
        <li key={row.key} className="space-y-1" data-row={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground truncate font-medium">{row.label}</span>
            <span className="text-muted-foreground shrink-0">
              {row.detail && <span className="me-2">{row.detail}</span>}
              <bdi className="text-foreground font-medium">{formatMoney(row.amount, "IQD")}</bdi>
              <span className="ms-2">{row.percent}</span>
            </span>
          </div>
          <div className="bg-muted h-2 rounded-full" aria-hidden>
            <div
              className="bg-primary h-2 rounded-full"
              style={{ width: `${Math.max(2, Math.round(row.bar * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

// The system accounts the app posts to, by chart-of-accounts code. The rows are
// seeded by the billing_foundation migration; keep both in step.

export const ACCOUNTS = {
  cash: "1000",
  card: "1010",
  wallet: "1020",
  bank: "1030",
  receivable: "1100",
  payable: "2000",
  patientDeposits: "2100",
  salariesPayable: "2200",
  equity: "3000",
  revenue: "4000",
  discounts: "4100",
  labExpense: "5000",
  salaries: "5100",
  commission: "5200",
  supplies: "5300",
  cashOverShort: "5800",
  otherExpense: "5900",
} as const

export type AccountKey = keyof typeof ACCOUNTS

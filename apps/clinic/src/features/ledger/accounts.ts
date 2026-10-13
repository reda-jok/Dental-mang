// The system accounts the app posts to, by chart-of-accounts code. The rows are
// seeded by the billing_foundation, expenses and cash_close_takeout migrations; keep them in step.

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
  /** Cash handed to the owner at a close. */
  ownerDrawings: "3100",
  revenue: "4000",
  discounts: "4100",
  labExpense: "5000",
  salaries: "5100",
  /** What dentists are paid: an expense category; the P&L counts their calculated pay. */
  dentistPay: "5200",
  supplies: "5300",
  rent: "5400",
  utilities: "5500",
  maintenance: "5600",
  telecom: "5700",
  marketing: "5750",
  cashOverShort: "5800",
  otherExpense: "5900",
} as const

export type AccountKey = keyof typeof ACCOUNTS

import { AlarmClockIcon, ReceiptTextIcon, Undo2Icon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { InfoHint } from "@/components/info-hint"
import { Panel } from "@/components/panel"
import { Card, CardContent } from "@/components/ui/card"
import { InvoicesTable } from "@/features/billing/components/invoices-table"
import { NewInvoiceButton } from "@/features/billing/components/new-invoice-button"
import { PaymentButton } from "@/features/billing/components/payment-dialog"
import { PaymentsTable, RefundsTable } from "@/features/billing/components/payments-table"
import { RefundButton } from "@/features/billing/components/refund-dialog"
import { ReminderButton } from "@/features/billing/components/reminder-button"
import {
  getInvoiceFormData,
  getPatientBilling,
  getPatientDebt,
  getPaymentFormData,
} from "@/features/billing/data"
import { parseIsoDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
import { can } from "@/server/permissions"
import { requirePagePermission } from "@/server/session"

import { loadPatient } from "../load"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing")
  return { title: t("patientTab") }
}

export default async function PatientBillingPage({
  params,
  searchParams,
}: PageProps<"/patients/[id]/billing">) {
  const user = await requirePagePermission("billing:read")
  const patient = await loadPatient((await params).id)
  const { new: newKind } = await searchParams
  const canWrite = hasPermission(user.role, "billing:write")
  const [billing, debt, invoiceForm, paymentForm, canVoid, t, format] = await Promise.all([
    getPatientBilling(patient.id),
    getPatientDebt(patient.id),
    canWrite ? getInvoiceFormData(patient.id) : null,
    canWrite ? getPaymentFormData(patient.id) : null,
    can(user, "billing:void"),
    getTranslations("billing"),
    getFormatter(),
  ])
  const { account } = billing
  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>

  return (
    <div className="space-y-6">
      {debt && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <div className="flex items-start gap-3">
            <AlarmClockIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                {t("overdueBanner", {
                  amount: formatMoney(debt.overdue, "IQD"),
                  count: debt.daysLate,
                })}
              </p>
              <p className="text-sm">
                {debt.lastRemindedAt
                  ? t("lastReminded", {
                      date: format.dateTime(debt.lastRemindedAt, { dateStyle: "medium" }),
                    })
                  : t("neverReminded")}
                {debt.oldestDue &&
                  ` · ${t("dueSince", {
                    date: format.dateTime(parseIsoDate(debt.oldestDue)!, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }),
                  })}`}
              </p>
            </div>
          </div>
          {canWrite && (
            <ReminderButton
              patient={{ id: patient.id, fullName: patient.fullName, phone: patient.phone }}
              amount={debt.overdue}
              oldestDue={debt.oldestDue}
              clinic={debt.clinic}
            />
          )}
        </div>
      )}

      {account && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="gap-1 rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="space-y-1">
              <p className="text-sm text-slate-600">{t("summary.invoiced")}</p>
              <p className="text-2xl font-bold text-slate-900" data-summary="invoiced">
                {money(account.invoiced)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-1 rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="space-y-1">
              <p className="text-sm text-slate-600">{t("summary.paid")}</p>
              <p className="text-2xl font-bold text-green-700" data-summary="paid">
                {money(account.paid)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-1 rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="space-y-1">
              <p className="flex items-center gap-1 text-sm text-slate-600">
                {account.owes || account.credit === "0"
                  ? t("summary.balance")
                  : t("summary.credit")}
                {!account.owes && account.credit !== "0" && (
                  <InfoHint>{t("summaryCreditHint")}</InfoHint>
                )}
              </p>
              <p
                className={`text-2xl font-bold ${account.owes ? "text-red-700" : "text-blue-700"}`}
                data-summary="balance"
              >
                {money(account.owes ? account.balance : account.credit)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Panel
        icon={ReceiptTextIcon}
        title={t("patientTab")}
        description={t("paymentsSoon")}
        className="min-w-0"
        contentClassName="p-0"
        actions={
          invoiceForm &&
          paymentForm && (
            <>
              <PaymentButton patientId={patient.id} data={paymentForm} variant="outline" />
              <NewInvoiceButton
                patientId={patient.id}
                data={invoiceForm}
                initialKind={newKind === "visit" || newKind === "plan" ? newKind : undefined}
              />
            </>
          )
        }
      >
        {billing.invoices.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">{t("patientEmpty")}</p>
        ) : (
          <InvoicesTable rows={billing.invoices} showPatient={false} />
        )}
      </Panel>

      {account && (
        <Panel
          icon={WalletIcon}
          title={t("paymentsTitle")}
          className="min-w-0"
          contentClassName="p-0"
          actions={paymentForm && <RefundButton patientId={patient.id} data={paymentForm} />}
        >
          {billing.payments.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">{t("paymentsEmpty")}</p>
          ) : (
            <PaymentsTable rows={billing.payments} canVoid={canVoid} />
          )}
        </Panel>
      )}

      {billing.refunds.length > 0 && (
        <Panel
          icon={Undo2Icon}
          title={t("refundsTitle")}
          className="min-w-0"
          contentClassName="p-0"
        >
          <RefundsTable rows={billing.refunds} />
        </Panel>
      )}
    </div>
  )
}

import { ReceiptTextIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { Card, CardContent } from "@/components/ui/card"
import { InvoicesTable } from "@/features/billing/components/invoices-table"
import { NewInvoiceButton } from "@/features/billing/components/new-invoice-button"
import { getInvoiceFormData, listPatientInvoices } from "@/features/billing/data"
import { formatMoney } from "@/lib/money"
import { hasPermission } from "@/lib/permissions"
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
  const [{ invoices, totals }, formData, t] = await Promise.all([
    listPatientInvoices(patient.id),
    canWrite ? getInvoiceFormData(patient.id) : null,
    getTranslations("billing"),
  ])

  const summary = [
    { key: "invoiced", amount: totals.invoiced, className: "text-slate-900" },
    { key: "paid", amount: totals.paid, className: "text-green-700" },
    { key: "balance", amount: totals.balance, className: "text-red-700" },
  ] as const

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.key} className="gap-1 rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="space-y-1">
              <p className="text-sm text-slate-600">{t(`summary.${s.key}`)}</p>
              <p className={`text-2xl font-bold ${s.className}`} data-summary={s.key}>
                <span dir="ltr">{formatMoney(s.amount, "IQD")}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Panel
        icon={ReceiptTextIcon}
        title={t("patientTab")}
        description={t("paymentsSoon")}
        className="min-w-0"
        contentClassName="p-0"
        actions={
          formData && (
            <NewInvoiceButton
              patientId={patient.id}
              data={formData}
              initialKind={newKind === "visit" || newKind === "plan" ? newKind : undefined}
            />
          )
        }
      >
        {invoices.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">{t("patientEmpty")}</p>
        ) : (
          <InvoicesTable rows={invoices} showPatient={false} />
        )}
      </Panel>
    </div>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { WalletIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatMoney, fromMinor, parseAmount, toMinor } from "@/lib/money"

import { recordPaymentAction } from "../actions"
import type { PaymentFormData } from "../data"
import { recordPaymentSchema, type RecordPaymentInput } from "../schemas"
import { MethodPicker } from "./method-picker"

type Props = {
  patientId: string
  data: PaymentFormData
  /** Pay this invoice first (from the invoice page). */
  invoiceId?: string
  variant?: "default" | "outline"
}

export function PaymentButton({ patientId, data, invoiceId, variant = "default" }: Props) {
  const t = useTranslations("billing")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <WalletIcon />
        {t("pay")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("payTitle")}</DialogTitle>
            <DialogDescription>{t("payDescription")}</DialogDescription>
          </DialogHeader>
          {/* Remount per open: every opened form gets its own idempotency key. */}
          {open && (
            <PaymentForm
              patientId={patientId}
              data={data}
              invoiceId={invoiceId}
              onDone={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PaymentForm({
  patientId,
  data,
  invoiceId,
  onDone,
}: {
  patientId: string
  data: PaymentFormData
  invoiceId?: string
  onDone: () => void
}) {
  const t = useTranslations("billing")
  const tp = useTranslations("print")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()

  const preferred = data.openInvoices.find((i) => i.id === invoiceId)
  const owed = data.account.owes ? data.account.balance : "0"
  const form = useForm<RecordPaymentInput, unknown, z.output<typeof recordPaymentSchema>>({
    resolver: zodResolver(recordPaymentSchema),
    mode: "onTouched",
    defaultValues: {
      patientId,
      amount: preferred?.balance ?? (owed === "0" ? "" : owed),
      method: "cash",
      reference: "",
      invoiceId: preferred?.id ?? "",
      notes: "",
      idempotencyKey: crypto.randomUUID(),
    },
  })
  const { errors } = form.formState
  const method = useWatch({ control: form.control, name: "method" })
  const amount = useWatch({ control: form.control, name: "amount" })
  const parsed = parseAmount(amount ?? "", "IQD")
  const extra = parsed ? toMinor(parsed) - toMinor(owed) : 0n

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await recordPaymentAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        const receipt = `/print/receipt/${result.data.id}?print=1`
        toast.success(t("paymentRecorded", { number: result.data.number }), {
          action: {
            label: tp("printReceipt"),
            onClick: () => window.open(receipt, "_blank", "noopener"),
          },
          duration: 10_000,
        })
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <p className="rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">
          {data.account.owes
            ? t("owes", { amount: formatMoney(data.account.balance, "IQD") })
            : t("hasCredit", { amount: formatMoney(data.account.credit, "IQD") })}
        </p>

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="amount">{t("amount")}</FieldLabel>
          <Input
            id="amount"
            dir="ltr"
            inputMode="numeric"
            autoFocus
            aria-invalid={!!errors.amount}
            {...form.register("amount")}
          />
          {!errors.amount &&
            (extra > 0n ? (
              <FieldDescription className="text-blue-700">
                {t("overpayHint", { amount: formatMoney(fromMinor(extra), "IQD") })}
              </FieldDescription>
            ) : (
              <FieldDescription>{t("amountHint")}</FieldDescription>
            ))}
          <FieldError>{vm(errors.amount?.message)}</FieldError>
        </Field>

        <Field>
          <FieldLabel id="method-label">{t("method")}</FieldLabel>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <MethodPicker value={field.value} onChange={field.onChange} labelId="method-label" />
            )}
          />
        </Field>

        {method !== "cash" && (
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="reference">
              {t("reference")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
              <InfoHint>{t("referenceHint")}</InfoHint>
            </FieldLabel>
            <Input id="reference" dir="ltr" {...form.register("reference")} />
            <FieldError>{vm(errors.reference?.message)}</FieldError>
          </Field>
        )}

        {data.openInvoices.length > 0 && (
          <Field>
            <FieldLabel htmlFor="invoiceId">{t("applyTo")}</FieldLabel>
            <Controller
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <Select
                  value={field.value || "_auto"}
                  onValueChange={(v) => field.onChange(v === "_auto" ? "" : v)}
                >
                  <SelectTrigger id="invoiceId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">{t("applyAuto")}</SelectItem>
                    {data.openInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {t("applyInvoice", {
                          number: invoice.number,
                          amount: formatMoney(invoice.balance, "IQD"),
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        )}

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="paymentNotes">
            {t("notes")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea id="paymentNotes" rows={2} {...form.register("notes")} />
          <FieldError>{vm(errors.notes?.message)}</FieldError>
        </Field>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            <WalletIcon />
            {pending ? tc("saving") : t("recordPayment")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

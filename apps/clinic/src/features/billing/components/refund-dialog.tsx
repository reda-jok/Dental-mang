"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Undo2Icon } from "lucide-react"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatMoney } from "@/lib/money"

import { refundAction } from "../actions"
import type { PaymentFormData } from "../data"
import { refundSchema, type RefundInput } from "../schemas"
import { MethodPicker } from "./method-picker"

/** "Refund": gives money back from the patient's unused credit. Explains when unavailable. */
export function RefundButton({ patientId, data }: { patientId: string; data: PaymentFormData }) {
  const t = useTranslations("billing")
  const [open, setOpen] = useState(false)
  const reason = !data.canRefund
    ? t("refundNoPermission")
    : data.account.credit === "0"
      ? t("refundNoCredit")
      : null

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex" aria-label={`${t("refund")}: ${reason}`}>
            <Button variant="outline" disabled>
              <Undo2Icon />
              {t("refund")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Undo2Icon />
        {t("refund")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("refundTitle")}</DialogTitle>
            <DialogDescription>{t("refundDescription")}</DialogDescription>
          </DialogHeader>
          {open && <RefundForm patientId={patientId} data={data} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function RefundForm({
  patientId,
  data,
  onDone,
}: {
  patientId: string
  data: PaymentFormData
  onDone: () => void
}) {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<RefundInput, unknown, z.output<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    mode: "onTouched",
    defaultValues: {
      patientId,
      amount: data.account.credit,
      method: "cash",
      reference: "",
      reason: "",
    },
  })
  const { errors } = form.formState
  const method = useWatch({ control: form.control, name: "method" })

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await refundAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("refunded", { number: result.data.number }))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <p className="rounded-lg bg-slate-50 p-3 text-sm">
          {t("refundAvailable", { amount: formatMoney(data.account.credit, "IQD") })}
        </p>
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="refundAmount">{t("amount")}</FieldLabel>
          <Input
            id="refundAmount"
            dir="ltr"
            inputMode="numeric"
            aria-invalid={!!errors.amount}
            {...form.register("amount")}
          />
          <FieldError>{vm(errors.amount?.message)}</FieldError>
        </Field>
        <Field>
          <FieldLabel id="refund-method-label">{t("method")}</FieldLabel>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <MethodPicker
                value={field.value}
                onChange={field.onChange}
                labelId="refund-method-label"
              />
            )}
          />
        </Field>
        {method !== "cash" && (
          <Field>
            <FieldLabel htmlFor="refundReference">
              {t("reference")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
              <InfoHint>{t("referenceHint")}</InfoHint>
            </FieldLabel>
            <Input id="refundReference" dir="ltr" {...form.register("reference")} />
          </Field>
        )}
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="refundReason">{t("refundReason")}</FieldLabel>
          <Textarea
            id="refundReason"
            rows={2}
            placeholder={t("refundReasonPlaceholder")}
            aria-invalid={!!errors.reason}
            {...form.register("reason")}
          />
          <FieldError>{vm(errors.reason?.message)}</FieldError>
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            <Undo2Icon />
            {pending ? tc("saving") : t("refundConfirm")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { nextMonth } from "@/lib/dates"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"

import { setDentistPayAction } from "../actions"
import type { PayVersion } from "../commission"
import { PAY_TYPES, setPaySchema, type SetPayInput } from "../schemas"

type Props = {
  dentist: { id: string; name: string }
  pay: PayVersion | null
  /** "YYYY-MM": changes start this month or later. */
  currentMonth: string
}

/** How a dentist is paid, from a chosen month on; earlier months keep their pay. */
export function PayDialog({ dentist, pay, currentMonth }: Props) {
  const t = useTranslations("hr")
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={t("editPay", { name: dentist.name })} onClick={() => setOpen(true)}>
        <PencilIcon />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("payTitle", { name: dentist.name })}</DialogTitle>
            <DialogDescription>{t("payDescription")}</DialogDescription>
          </DialogHeader>
          {open && (
            <PayForm
              dentist={dentist}
              pay={pay}
              currentMonth={currentMonth}
              onDone={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PayForm({ dentist, pay, currentMonth, onDone }: Props & { onDone: () => void }) {
  const t = useTranslations("hr")
  const tc = useTranslations("common")
  const format = useFormatter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<SetPayInput, unknown, z.output<typeof setPaySchema>>({
    resolver: zodResolver(setPaySchema),
    mode: "onTouched",
    defaultValues: {
      dentistId: dentist.id,
      payType: pay?.payType ?? "commission",
      commissionRate: pay?.commissionRate.replace(/\.00$/, "") ?? "",
      monthlySalary: pay?.monthlySalary?.replace(/\.00$/, "") ?? "",
      deductLab: pay?.deductLab ?? true,
      effectiveFrom: currentMonth,
    },
  })
  const { errors } = form.formState
  const payType = useWatch({ control: form.control, name: "payType" })
  const months = [currentMonth, nextMonth(currentMonth), nextMonth(nextMonth(currentMonth))]
  const monthName = (m: string) =>
    format.dateTime(new Date(`${m}-01T00:00:00Z`), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await setDentistPayAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("paySaved"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="payType"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="payType">{t("payType")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="payType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`payTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        {payType !== "salary" && (
          <TextField
            id="commissionRate"
            inputMode="decimal"
            dir="ltr"
            className="max-w-32"
            label={t("rate")}
            description={t("rateHint")}
            error={errors.commissionRate?.message}
            {...form.register("commissionRate")}
          />
        )}
        {payType !== "commission" && (
          <TextField
            id="monthlySalary"
            inputMode="numeric"
            dir="ltr"
            label={t("salary")}
            error={errors.monthlySalary?.message}
            {...form.register("monthlySalary")}
          />
        )}
        {payType !== "salary" && (
          <Controller
            control={form.control}
            name="deductLab"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="deductLab"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
                <Label htmlFor="deductLab">{t("deductLab")}</Label>
                <InfoHint>{t("deductLabHint")}</InfoHint>
              </div>
            )}
          />
        )}
        <Controller
          control={form.control}
          name="effectiveFrom"
          render={({ field }) => (
            <Field data-invalid={!!errors.effectiveFrom}>
              <FieldLabel htmlFor="effectiveFrom">
                {t("effectiveFrom")}
                <InfoHint>{t("effectiveFromHint")}</InfoHint>
              </FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="effectiveFrom" className="max-w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {monthName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{vm(errors.effectiveFrom?.message)}</FieldError>
            </Field>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"
import { toast } from "sonner"

import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
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
import { useActionErrorHandler, useValidationMessage, useInvalidHandler } from "@/lib/form"

import { updateClinicSettingsAction } from "../actions"
import { clinicSettingsSchema, PRINT_PAPERS, type ClinicSettingsInput } from "../schemas"

type Props = {
  initial: {
    name: string
    phone: string | null
    address: string | null
    receiptFooter: string | null
    invoiceDueDays: number
    printPaper: "A5" | "A4"
  }
  canEdit: boolean
}

export function ClinicSettingsForm({ initial, canEdit }: Props) {
  const t = useTranslations("settings")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<ClinicSettingsInput, unknown, z.output<typeof clinicSettingsSchema>>({
    resolver: zodResolver(clinicSettingsSchema),
    mode: "onTouched",
    defaultValues: {
      name: initial.name,
      phone: initial.phone ?? "",
      address: initial.address ?? "",
      receiptFooter: initial.receiptFooter ?? "",
      invoiceDueDays: String(initial.invoiceDueDays),
      printPaper: initial.printPaper,
    },
  })
  const { errors, isDirty } = form.formState

  // The server validates again, so send the raw form values.
  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = await updateClinicSettingsAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(tc("saved"))
        form.reset(values)
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      <fieldset disabled={!canEdit || pending}>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError>{vm(errors.name?.message)}</FieldError>
          </Field>

          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">
              {t("phone")}{" "}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
              <InfoHint>{t("phoneHint")}</InfoHint>
            </FieldLabel>
            <Input
              id="phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0770 123 4567"
              aria-invalid={!!errors.phone}
              {...form.register("phone")}
            />
            <FieldError>{vm(errors.phone?.message)}</FieldError>
          </Field>

          <Field data-invalid={!!errors.address}>
            <FieldLabel htmlFor="address">
              {t("address")}{" "}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            </FieldLabel>
            <Input id="address" aria-invalid={!!errors.address} {...form.register("address")} />
            <FieldError>{vm(errors.address?.message)}</FieldError>
          </Field>

          <Field data-invalid={!!errors.receiptFooter}>
            <FieldLabel htmlFor="receiptFooter">
              {t("receiptFooter")}{" "}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            </FieldLabel>
            <Textarea
              id="receiptFooter"
              rows={3}
              aria-invalid={!!errors.receiptFooter}
              {...form.register("receiptFooter")}
            />
            {!errors.receiptFooter && <FieldDescription>{t("receiptFooterHint")}</FieldDescription>}
            <FieldError>{vm(errors.receiptFooter?.message)}</FieldError>
          </Field>

          <Field data-invalid={!!errors.invoiceDueDays} className="max-w-48">
            <FieldLabel htmlFor="invoiceDueDays">
              {t("invoiceDueDays")}
              <InfoHint>{t("invoiceDueDaysHint")}</InfoHint>
            </FieldLabel>
            <Input
              id="invoiceDueDays"
              dir="ltr"
              inputMode="numeric"
              aria-invalid={!!errors.invoiceDueDays}
              {...form.register("invoiceDueDays")}
            />
            <FieldError>{vm(errors.invoiceDueDays?.message)}</FieldError>
          </Field>

          <Field className="max-w-64">
            <FieldLabel htmlFor="printPaper">
              {t("printPaper")}
              <InfoHint>{t("printPaperHint")}</InfoHint>
            </FieldLabel>
            <Controller
              control={form.control}
              name="printPaper"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="printPaper">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINT_PAPERS.map((paper) => (
                      <SelectItem key={paper} value={paper}>
                        {t(`papers.${paper}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {canEdit && (
            <div>
              <Button type="submit" disabled={!isDirty || pending}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </div>
          )}
        </FieldGroup>
      </fieldset>
    </form>
  )
}

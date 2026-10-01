"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { TextField } from "@/components/form-field"
import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
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
import { useActionErrorHandler, useValidationMessage, useInvalidHandler } from "@/lib/form"

import { TOOTH_CONDITIONS } from "../../chart/teeth"
import { createProcedureAction, updateProcedureAction } from "../actions"
import type { Catalog, CatalogProcedure } from "../data"
import {
  createProcedureSchema,
  TOOTH_SCOPES,
  updateProcedureSchema,
  type ProcedureFormInput,
} from "../schemas"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Pick<Catalog[number], "id" | "name">[]
  procedure?: CatalogProcedure
  defaultCategoryId?: string
}

export function ProcedureDialog({
  open,
  onOpenChange,
  categories,
  procedure,
  defaultCategoryId,
}: Props) {
  const t = useTranslations("procedures")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{procedure ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        {open && (
          <ProcedureForm
            categories={categories}
            procedure={procedure}
            defaultCategoryId={defaultCategoryId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProcedureForm({
  categories,
  procedure,
  defaultCategoryId,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<ProcedureFormInput>({
    resolver: zodResolver(
      (procedure ? updateProcedureSchema : createProcedureSchema) as never,
    ) as never,
    mode: "onTouched",
    defaultValues: {
      // The update schema validates the id too, so it must be a form value.
      ...(procedure && ({ id: procedure.id } as object)),
      name: procedure?.name ?? "",
      categoryId: procedure?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
      currency: "IQD", // the clinic works in dinars only
      price: procedure?.price ?? "",
      toothScope: procedure?.toothScope ?? "tooth",
      chartResult: (procedure?.chartResult ?? "") as ProcedureFormInput["chartResult"],
      durationMinutes: procedure?.durationMinutes ? String(procedure.durationMinutes) : "",
      requiresLab: procedure?.requiresLab ?? false,
    },
  })
  const { errors } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = procedure
          ? await updateProcedureAction(values as never)
          : await createProcedureAction(values as never)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t(procedure ? "procedures.updated" : "procedures.created"))
        onDone()
      }),
    onInvalid,
  )

  const select = <K extends "categoryId" | "toothScope" | "chartResult">(
    name: K,
    label: React.ReactNode,
    options: { value: string; label: string }[],
    hint?: string,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!errors[name]}>
          <FieldLabel htmlFor={name}>
            {label}
            {hint && <InfoHint>{hint}</InfoHint>}
          </FieldLabel>
          <Select
            value={field.value || "_none"}
            onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
          >
            <SelectTrigger id={name} aria-invalid={!!errors[name]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value || "_none"} value={o.value || "_none"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{vm(errors[name]?.message)}</FieldError>
        </Field>
      )}
    />
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="name"
          label={t("procedures.name")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        {select(
          "categoryId",
          t("procedures.category"),
          categories.map((c) => ({ value: c.id, label: c.name })),
        )}
        <TextField
          id="price"
          inputMode="numeric"
          dir="ltr"
          label={t("procedures.price")}
          description={t("procedures.priceHint")}
          error={errors.price?.message}
          {...form.register("price")}
        />
        {select(
          "toothScope",
          t("procedures.toothScope"),
          TOOTH_SCOPES.map((s) => ({ value: s, label: t(`procedures.toothScopes.${s}`) })),
          t("procedures.toothScopeHint"),
        )}
        {select(
          "chartResult",
          t("procedures.chartResult"),
          [
            { value: "", label: t("procedures.chartResultNone") },
            ...TOOTH_CONDITIONS.map((c) => ({
              value: c.code,
              label: t(`chart.conditions.${c.code}`),
            })),
          ],
          t("procedures.chartResultHint"),
        )}
        <TextField
          id="durationMinutes"
          inputMode="numeric"
          dir="ltr"
          optional
          className="max-w-32"
          label={t("procedures.duration")}
          info={t("procedures.durationHint")}
          error={errors.durationMinutes?.message}
          {...form.register("durationMinutes")}
        />
        <Controller
          control={form.control}
          name="requiresLab"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresLab"
                checked={field.value}
                onCheckedChange={(c) => field.onChange(c === true)}
              />
              <Label htmlFor="requiresLab">{t("procedures.requiresLab")}</Label>
              <InfoHint>{t("procedures.requiresLabHint")}</InfoHint>
            </div>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

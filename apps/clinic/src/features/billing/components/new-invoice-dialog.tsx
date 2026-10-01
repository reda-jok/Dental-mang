"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { addDays, parseIsoDate } from "@/lib/dates"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatMoney, parseAmount } from "@/lib/money"
import { cn } from "@/lib/utils"
import { toLatinDigits } from "@/lib/validation"

import { createInvoiceAction } from "../actions"
import type { InvoiceFormData } from "../data"
import { toothText } from "../display"
import { invoiceTotals } from "../rules"
import { createInvoiceSchema, type CreateInvoiceInput } from "../schemas"

type Kind = "visit" | "plan"

type Props = {
  patientId: string
  data: InvoiceFormData
  open: boolean
  onOpenChange: (open: boolean) => void
  initialKind?: Kind
}

export function NewInvoiceDialog({ patientId, data, open, onOpenChange, initialKind }: Props) {
  const t = useTranslations("billing")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
          <DialogDescription>{t("newDescription")}</DialogDescription>
        </DialogHeader>
        {/* Remount per open so every invoice starts from the current data. */}
        {open && (
          <InvoiceForm
            patientId={patientId}
            data={data}
            initialKind={initialKind ?? "visit"}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Item = InvoiceFormData["plans"][number]["items"][number] & { planId: string }

function InvoiceForm({
  patientId,
  data,
  initialKind,
  onDone,
}: {
  patientId: string
  data: InvoiceFormData
  initialKind: Kind
  onDone: () => void
}) {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const te = useTranslations("validation")
  const format = useFormatter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState("")

  const allItems: Item[] = data.plans.flatMap((plan) =>
    plan.items.map((item) => ({ ...item, planId: plan.id })),
  )
  const doneItems = allItems.filter((item) => item.status === "done")
  const itemById = new Map(allItems.map((item) => [item.id, item]))
  const procedureById = new Map(data.catalog.flatMap((c) => c.procedures).map((p) => [p.id, p]))

  // A discount already agreed on the plan is carried over.
  const itemLine = (item: Item) => ({
    planItemId: item.id,
    quantity: "1",
    discount: item.discount === "0" ? "" : item.discount,
  })
  const itemsFor = (kind: Kind, planId: string) =>
    kind === "visit" ? doneItems : allItems.filter((item) => item.planId === planId)

  const firstPlanId = data.plans[0]?.id ?? ""
  const form = useForm<CreateInvoiceInput, unknown, z.output<typeof createInvoiceSchema>>({
    resolver: zodResolver(createInvoiceSchema),
    mode: "onTouched",
    defaultValues: {
      patientId,
      kind: initialKind,
      planId: initialKind === "plan" ? firstPlanId : "",
      lines: itemsFor(initialKind, firstPlanId).map(itemLine),
      extraDiscount: "",
      dueDate: addDays(data.today, data.dueDays),
      notes: "",
    },
  })
  const { errors } = form.formState
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  })
  const kind = useWatch({ control: form.control, name: "kind" })
  const planId = useWatch({ control: form.control, name: "planId" }) ?? ""
  const lines = useWatch({ control: form.control, name: "lines" })
  const extraDiscount = useWatch({ control: form.control, name: "extraDiscount" })

  /** Switching kind or plan reloads its treatments; procedures added from the catalog stay. */
  const switchTo = (nextKind: Kind, nextPlanId: string) => {
    form.setValue("kind", nextKind)
    form.setValue("planId", nextKind === "plan" ? nextPlanId : "")
    const catalogLines = form.getValues("lines").filter((line) => line.procedureId)
    replace([...itemsFor(nextKind, nextPlanId).map(itemLine), ...catalogLines])
  }

  const candidates = itemsFor(kind, planId)
  const indexOfItem = (id: string) => fields.findIndex((field) => field.planItemId === id)
  const toggle = (item: Item, checked: boolean) => {
    const index = indexOfItem(item.id)
    if (checked && index < 0) append(itemLine(item))
    if (!checked && index >= 0) remove(index)
  }

  // Live totals, with the same rules the server applies.
  const totals = invoiceTotals(
    (lines ?? []).map((line) => ({
      quantity: line.planItemId ? 1 : Number(toLatinDigits(line.quantity ?? "")) || 1,
      unitPrice:
        (line.planItemId
          ? itemById.get(line.planItemId)?.price
          : procedureById.get(line.procedureId ?? "")?.price) ?? "0",
      discount: parseAmount(line.discount ?? "", "IQD") ?? "0",
    })),
    parseAmount(extraDiscount ?? "", "IQD") ?? "0",
  )

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createInvoiceAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("issued", { number: result.data.number }))
        onDone()
        router.push(`/billing/${result.data.id}` as Route)
      }),
    onInvalid,
  )

  const money = (amount: string) => <span dir="ltr">{formatMoney(amount, "IQD")}</span>
  const nameOf = (item: Item) => {
    const tooth = toothText(item.tooth, item.surfaces)
    return tooth ? `${item.procedureName} (${t("toothLabel", { tooth })})` : item.procedureName
  }

  const discountInput = (index: number, label: string) => {
    const error = errors.lines?.[index]?.discount?.message
    return (
      <div className="w-28 space-y-1">
        <Input
          dir="ltr"
          inputMode="numeric"
          placeholder={t("discount")}
          aria-label={label}
          aria-invalid={!!error}
          {...form.register(`lines.${index}.discount`)}
        />
        {error && <p className="text-destructive text-xs">{vm(error)}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {/* Kind */}
        <FieldSet>
          <FieldLegend variant="label">{t("kind")}</FieldLegend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["visit", "plan"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                disabled={k === "plan" && data.plans.length === 0}
                onClick={() => switchTo(k, planId || firstPlanId)}
                className={cn(
                  "rounded-xl border p-3 text-start transition-colors disabled:opacity-50",
                  kind === k
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-slate-200 hover:bg-slate-50",
                )}
              >
                <span className="block font-medium">
                  {t(k === "visit" ? "kindVisit" : "kindPlan")}
                </span>
                <span className="block text-xs text-slate-500">
                  {t(k === "visit" ? "kindVisitHint" : "kindPlanHint")}
                </span>
              </button>
            ))}
          </div>
        </FieldSet>

        {kind === "plan" && (
          <Field data-invalid={!!errors.planId}>
            <FieldLabel htmlFor="planId">{t("plan")}</FieldLabel>
            <Select value={planId} onValueChange={(id) => switchTo("plan", id)}>
              <SelectTrigger id="planId" aria-invalid={!!errors.planId}>
                <SelectValue placeholder={t("planPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {data.plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{vm(errors.planId?.message)}</FieldError>
          </Field>
        )}

        {/* Treatments from the plans */}
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
            {kind === "visit" ? t("noDoneItems") : t("noPlans")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {candidates.map((item) => {
              const index = indexOfItem(item.id)
              const name = nameOf(item)
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={index >= 0}
                    onCheckedChange={(checked) => toggle(item, checked === true)}
                  />
                  <Label
                    htmlFor={`item-${item.id}`}
                    className="min-w-40 flex-1 flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{name}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {[
                        kind === "plan" &&
                          t(`itemStatuses.${item.status as "planned" | "in_progress" | "done"}`),
                        item.completedOn &&
                          format.dateTime(parseIsoDate(item.completedOn)!, {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          }),
                        item.dentistName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Label>
                  {/* On narrow screens the amounts wrap below the name. */}
                  <div className="ms-auto flex items-center gap-3">
                    {index >= 0 &&
                      data.canDiscount &&
                      discountInput(index, t("lineDiscount", { name }))}
                    <span className="w-28 text-end font-medium">{money(item.price)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Procedures added from the catalog */}
        {fields.some((field) => field.procedureId) && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {fields.map((field, index) => {
              const procedure = field.procedureId ? procedureById.get(field.procedureId) : null
              if (!procedure) return null
              const quantityError = errors.lines?.[index]?.quantity?.message
              return (
                <li key={field.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-40 flex-1 font-medium">{procedure.name}</span>
                  <div className="ms-auto flex items-center gap-3">
                    <div className="w-16 space-y-1">
                      <Input
                        dir="ltr"
                        inputMode="numeric"
                        aria-label={t("lineQuantity", { name: procedure.name })}
                        aria-invalid={!!quantityError}
                        {...form.register(`lines.${index}.quantity`)}
                      />
                      {quantityError && (
                        <p className="text-destructive text-xs">{vm(quantityError)}</p>
                      )}
                    </div>
                    {data.canDiscount &&
                      discountInput(index, t("lineDiscount", { name: procedure.name }))}
                    <span className="w-28 text-end font-medium">{money(procedure.price)}</span>
                    <IconButton
                      label={t("removeLine", { name: procedure.name })}
                      onClick={() => remove(index)}
                      className="text-destructive"
                    >
                      <Trash2Icon />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {data.catalog.length > 0 && (
          <Field>
            <FieldLabel htmlFor="addProcedure">
              <PlusIcon className="size-4" aria-hidden />
              {t("addProcedure")}
              <InfoHint>{t("addProcedureHint")}</InfoHint>
            </FieldLabel>
            <Select
              value={adding}
              onValueChange={(id) => {
                append({ procedureId: id, quantity: "1", discount: "" })
                setAdding("")
              }}
            >
              <SelectTrigger id="addProcedure">
                <SelectValue placeholder={t("addProcedurePlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {data.catalog.map((category) => (
                  <SelectGroup key={category.id}>
                    <SelectLabel>{category.name}</SelectLabel>
                    {category.procedures.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        <span className="text-muted-foreground ms-auto text-xs" dir="ltr">
                          {formatMoney(p.price, "IQD")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {data.canDiscount ? (
            <Field data-invalid={!!errors.extraDiscount}>
              <FieldLabel htmlFor="extraDiscount">
                {t("extraDiscount")}
                <InfoHint>{t("extraDiscountHint")}</InfoHint>
              </FieldLabel>
              <Input
                id="extraDiscount"
                dir="ltr"
                inputMode="numeric"
                placeholder="0"
                aria-invalid={!!errors.extraDiscount}
                {...form.register("extraDiscount")}
              />
              <FieldError>{vm(errors.extraDiscount?.message)}</FieldError>
            </Field>
          ) : (
            <p className="self-end text-xs text-slate-500">{t("noDiscountPermission")}</p>
          )}
          <Field data-invalid={!!errors.dueDate}>
            <FieldLabel htmlFor="dueDate">{t("dueDate")}</FieldLabel>
            <Input
              id="dueDate"
              type="date"
              dir="ltr"
              min={data.today}
              aria-invalid={!!errors.dueDate}
              {...form.register("dueDate")}
            />
            {!errors.dueDate && (
              <FieldDescription>
                {t("dueDateHint", { days: String(data.dueDays) })}
              </FieldDescription>
            )}
            <FieldError>{vm(errors.dueDate?.message)}</FieldError>
          </Field>
        </div>

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">
            {t("notes")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea id="notes" rows={2} {...form.register("notes")} />
          <FieldError>{vm(errors.notes?.message)}</FieldError>
        </Field>

        {/* Totals */}
        <div className="rounded-xl bg-slate-50 p-4" aria-live="polite">
          {totals.ok ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>{t("subtotal")}</dt>
                <dd>{money(totals.totals.subtotal)}</dd>
              </div>
              {totals.totals.discountTotal !== "0" && (
                <div className="flex justify-between text-green-700">
                  <dt>{t("discounts")}</dt>
                  <dd>{money(totals.totals.discountTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>{t("total")}</dt>
                <dd data-testid="invoice-total">{money(totals.totals.total)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">
              {totals.error === "emptyInvoice" && fields.length === 0
                ? t("selectAtLeastOne")
                : te(totals.error as "lineDiscountTooLarge")}
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-xs text-slate-500">{t("issueHint")}</p>
          <Button type="submit" disabled={pending || fields.length === 0}>
            <ReceiptTextIcon />
            {pending ? tc("saving") : t("issue")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

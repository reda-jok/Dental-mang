"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  FilePlus2Icon,
  OctagonAlertIcon,
  PlusIcon,
  TriangleAlertIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { IconButton } from "@/components/icon-button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"

import { createPrescriptionAction } from "../actions"
import type { PrescriptionFormData } from "../data"
import { needsConfirmation, prescriptionWarnings } from "../rules"
import { createPrescriptionSchema, type CreatePrescriptionInput } from "../schemas"

export function NewPrescriptionButton({
  patientId,
  data,
}: {
  patientId: string
  data: PrescriptionFormData
}) {
  const t = useTranslations("prescriptions")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FilePlus2Icon />
        {t("new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
            <DialogDescription>{t("newDescription")}</DialogDescription>
          </DialogHeader>
          {open && (
            <PrescriptionForm patientId={patientId} data={data} onDone={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PrescriptionForm({
  patientId,
  data,
  onDone,
}: {
  patientId: string
  data: PrescriptionFormData
  onDone: () => void
}) {
  const t = useTranslations("prescriptions")
  const tm = useTranslations("medical")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState("")

  const form = useForm<CreatePrescriptionInput, unknown, z.output<typeof createPrescriptionSchema>>(
    {
      resolver: zodResolver(createPrescriptionSchema),
      mode: "onTouched",
      defaultValues: { patientId, items: [], notes: "", acknowledged: [] },
    },
  )
  const { errors, touchedFields, isSubmitted } = form.formState
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" }) ?? []
  const acknowledged = useWatch({ control: form.control, name: "acknowledged" }) ?? []
  const byId = new Map(data.catalog.map((m) => [m.id, m]))

  // The same warnings the server checks.
  const warnings = prescriptionWarnings(
    data.history,
    items.map((i) => ({
      name: i.name ?? "",
      group: i.medicationId ? (byId.get(i.medicationId)?.group ?? null) : null,
    })),
  )
  const toConfirm = needsConfirmation(warnings)
  const confirmed = toConfirm.every((code) => acknowledged.includes(code))

  const addMedication = (id: string) => {
    if (id === "_other") {
      // Not focused: the picker takes focus back when it closes, which would mark the
      // empty name as touched and show "required" before anything is typed.
      append(
        { medicationId: "", name: "", dose: "", frequency: "", duration: "", notes: "" },
        { shouldFocus: false },
      )
      return
    }
    const m = byId.get(id)
    if (!m) return
    append({
      medicationId: m.id,
      name: m.name,
      dose: m.dose ?? "",
      frequency: m.frequency ?? "",
      duration: m.duration ?? "",
      notes: "",
    })
  }

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createPrescriptionAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        const print = `/print/prescription/${result.data.id}?print=1`
        toast.success(t("saved"), {
          action: { label: t("print"), onClick: () => window.open(print, "_blank", "noopener") },
          duration: 10_000,
        })
        onDone()
      }),
    onInvalid,
  )

  const history = data.history
  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {/* What's on record, for the dentist to see while prescribing. */}
        <div className="rounded-lg bg-slate-50 p-3 text-sm" data-testid="medical-summary">
          {!history ? (
            <p className="text-amber-700">{t("noHistory")}</p>
          ) : (
            <dl className="space-y-1">
              <div className="flex flex-wrap gap-1">
                <dt className="font-medium">{t("allergies")}:</dt>
                <dd>
                  {[
                    ...history.allergies.map((a) => tm(`allergies.${a as "penicillin"}`)),
                    history.otherAllergies,
                  ]
                    .filter(Boolean)
                    .join("، ") || t("noneRecorded")}
                </dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="font-medium">{t("currentMedicines")}:</dt>
                <dd>{history.medications || t("noneRecorded")}</dd>
              </div>
            </dl>
          )}
        </div>

        {fields.length > 0 && (
          <ol className="space-y-3">
            {fields.map((field, index) => {
              const catalogItem = field.medicationId ? byId.get(field.medicationId) : null
              // Adding a row re-checks the whole list; show a row's errors only once
              // its field was touched or the form submitted (not as soon as it appears).
              const error = (key: "name" | "dose" | "frequency" | "duration") =>
                touchedFields.items?.[index]?.[key] || isSubmitted
                  ? errors.items?.[index]?.[key]?.message
                  : undefined
              return (
                <li
                  key={field.id}
                  className="rounded-xl border border-slate-200 p-3"
                  data-item={index}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-sm font-bold text-slate-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      {catalogItem ? (
                        <p className="font-semibold" dir="ltr">
                          <span className="block text-start">{catalogItem.name}</span>
                        </p>
                      ) : (
                        <Field data-invalid={!!error("name")}>
                          <Input
                            dir="ltr"
                            placeholder={t("otherNamePlaceholder")}
                            aria-label={t("otherName")}
                            aria-invalid={!!error("name")}
                            {...form.register(`items.${index}.name`)}
                          />
                          <FieldError>{vm(error("name"))}</FieldError>
                        </Field>
                      )}
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(["dose", "frequency", "duration"] as const).map((key) => (
                          <Input
                            key={key}
                            placeholder={t(key)}
                            aria-label={`${t(key)}: ${field.name || t("otherName")}`}
                            aria-invalid={!!error(key)}
                            {...form.register(`items.${index}.${key}`)}
                          />
                        ))}
                      </div>
                    </div>
                    <IconButton
                      label={t("remove", { name: field.name || t("otherName") })}
                      onClick={() => remove(index)}
                      className="text-destructive"
                    >
                      <Trash2Icon />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <Field data-invalid={!!errors.items?.message}>
          <FieldLabel htmlFor="addMedicine">
            <PlusIcon className="size-4" aria-hidden />
            {t("addMedicine")}
          </FieldLabel>
          <Select
            value={adding}
            onValueChange={(id) => {
              addMedication(id)
              setAdding("")
            }}
          >
            <SelectTrigger id="addMedicine">
              <SelectValue placeholder={t("addMedicinePlaceholder")} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {data.catalog.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span dir="ltr">{m.name}</span>
                </SelectItem>
              ))}
              <SelectItem value="_other">{t("otherMedicine")}</SelectItem>
            </SelectContent>
          </Select>
          <FieldError>{vm(errors.items?.message ?? errors.items?.root?.message)}</FieldError>
        </Field>

        {warnings.length > 0 && (
          <div className="space-y-2" aria-live="polite">
            {warnings.map((w, i) =>
              w.level === "danger" ? (
                <p
                  key={i}
                  data-warning="danger"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800"
                >
                  <OctagonAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("warningAllergy", {
                    allergy: tm(`allergies.${w.code as "penicillin"}`),
                    medicine: w.medication,
                  })}
                </p>
              ) : (
                <p
                  key={i}
                  data-warning="caution"
                  className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {w.kind === "condition"
                    ? t("warningCondition", {
                        condition: tm(`conditions.${w.code as "asthma"}`),
                        medicine: w.medication,
                      })
                    : w.kind === "pregnancy"
                      ? t("warningPregnancy")
                      : t("noHistory")}
                </p>
              ),
            )}
            {toConfirm.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 p-3">
                <Checkbox
                  id="confirmAllergy"
                  checked={confirmed}
                  onCheckedChange={(checked) =>
                    form.setValue("acknowledged", checked === true ? toConfirm : [])
                  }
                />
                <Label htmlFor="confirmAllergy" className="text-sm text-red-800">
                  {t("confirmAllergy")}
                </Label>
              </div>
            )}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="rxNotes">
            {t("notes")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea
            id="rxNotes"
            rows={2}
            placeholder={t("notesPlaceholder")}
            {...form.register("notes")}
          />
        </Field>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-xs text-slate-500">{t("responsibility")}</p>
          <Button type="submit" disabled={pending || fields.length === 0 || !confirmed}>
            <FilePlus2Icon />
            {pending ? tc("saving") : t("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

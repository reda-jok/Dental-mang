"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FlaskConicalIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
import { IconButton } from "@/components/icon-button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { addDays } from "@/lib/dates"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"

import { createLabCaseAction, updateLabCaseAction } from "../actions"
import type { LabCaseView, LabFormOptions, LabPlanItem } from "../data"
import { MATERIALS, SHADES } from "../rules"
import { createLabCaseSchema, type LabCaseInput } from "../schemas"

type Props = {
  options: LabFormOptions
  /** New case for this patient (with their treatments that need a lab)… */
  patientId?: string
  planItems?: LabPlanItem[]
  /** …or edit this case. */
  labCase?: LabCaseView
}

export function LabCaseButton(props: Props) {
  const t = useTranslations("lab")
  const [open, setOpen] = useState(false)
  const editing = !!props.labCase
  return (
    <>
      {editing ? (
        <IconButton
          label={t("editCase", { number: props.labCase!.number })}
          onClick={() => setOpen(true)}
        >
          <PencilIcon />
        </IconButton>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={props.options.labs.length === 0}>
          <PlusIcon />
          {t("newCase")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConicalIcon className="size-5 text-blue-600" aria-hidden />
              {editing ? t("editTitle") : t("newCase")}
            </DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
          </DialogHeader>
          {open && <LabCaseForm {...props} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LabCaseForm({
  options,
  patientId,
  planItems = [],
  labCase,
  onDone,
}: Props & { onDone: () => void }) {
  const t = useTranslations("lab")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const firstLab = options.labs[0]

  const form = useForm<LabCaseInput, unknown, z.output<typeof createLabCaseSchema>>({
    resolver: zodResolver(createLabCaseSchema as never) as never,
    mode: "onTouched",
    defaultValues: labCase
      ? {
          patientId: labCase.patient.id,
          labId: labCase.labId,
          dentistId: labCase.dentistId ?? "",
          planItemId: labCase.planItemId ?? "",
          work: labCase.work,
          teeth: labCase.teeth.join(", "),
          shade: labCase.shade ?? "",
          material: (labCase.material ?? "") as LabCaseInput["material"],
          instructions: labCase.instructions ?? "",
          cost: labCase.cost === "0" ? "" : labCase.cost,
          sentOn: labCase.sentOn,
          dueOn: labCase.dueOn,
        }
      : {
          patientId: patientId ?? "",
          labId: firstLab?.id ?? "",
          dentistId: "",
          planItemId: "",
          work: "",
          teeth: "",
          shade: "",
          material: "",
          instructions: "",
          cost: "",
          sentOn: options.today,
          dueOn: addDays(options.today, firstLab?.turnaroundDays ?? 7),
        },
  })
  const { errors, dirtyFields } = form.formState
  const sentOn = useWatch({ control: form.control, name: "sentOn" })
  const planItemId = useWatch({ control: form.control, name: "planItemId" })

  // A lab's usual turnaround sets the due date, until the user picks one.
  const setDueFor = (labId: string, sent = sentOn) => {
    const lab = options.labs.find((l) => l.id === labId)
    if (lab && !dirtyFields.dueOn && sent) form.setValue("dueOn", addDays(sent, lab.turnaroundDays))
  }

  const pickItem = (id: string) => {
    form.setValue("planItemId", id === "_none" ? "" : id)
    const item = planItems.find((i) => i.id === id)
    if (!item) return
    form.setValue("work", item.work, { shouldValidate: true })
    form.setValue("teeth", item.tooth ? String(item.tooth) : "")
    if (item.dentistId) form.setValue("dentistId", item.dentistId)
  }

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = labCase
          ? await updateLabCaseAction({
              id: labCase.id,
              labId: values.labId,
              dentistId: values.dentistId,
              work: values.work,
              teeth: values.teeth,
              shade: values.shade,
              material: values.material,
              instructions: values.instructions,
              cost: values.cost,
              sentOn: values.sentOn,
              dueOn: values.dueOn,
            })
          : await createLabCaseAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(labCase ? t("updated") : t("created"))
        onDone()
      }),
    onInvalid,
  )

  const select = (
    name: "labId" | "dentistId" | "material",
    label: string,
    items: { value: string; label: string }[],
    onChange?: (value: string) => void,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!errors[name]}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select
            value={field.value || "_none"}
            onValueChange={(v) => {
              field.onChange(v === "_none" ? "" : v)
              onChange?.(v)
            }}
          >
            <SelectTrigger id={name} aria-invalid={!!errors[name]}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value || "_none"} value={i.value || "_none"}>
                  {i.label}
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
        {!labCase && planItems.length > 0 && (
          <Field>
            <FieldLabel htmlFor="planItemId">
              {t("planItem")}
              <InfoHint>{t("planItemHint")}</InfoHint>
            </FieldLabel>
            <Select value={planItemId || "_none"} onValueChange={pickItem}>
              <SelectTrigger id="planItemId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t("noPlanItem")}</SelectItem>
                {planItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.work}
                    {item.tooth && ` · ${t("toothLabel", { tooth: String(item.tooth) })}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {select(
            "labId",
            t("lab"),
            options.labs.map((l) => ({ value: l.id, label: l.name })),
            (id) => setDueFor(id),
          )}
          {select("dentistId", t("dentist"), [
            { value: "", label: t("noDentist") },
            ...options.dentists.map((d) => ({ value: d.id, label: d.name })),
          ])}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="work"
            label={t("work")}
            placeholder={t("workPlaceholder")}
            error={errors.work?.message}
            {...form.register("work")}
          />
          <TextField
            id="teeth"
            dir="ltr"
            label={t("teeth")}
            info={t("teethHint")}
            placeholder="16, 17"
            error={errors.teeth?.message}
            {...form.register("teeth")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.shade}>
            <FieldLabel htmlFor="shade">
              {t("shade")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            </FieldLabel>
            <input
              id="shade"
              dir="ltr"
              list="lab-shades"
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
              {...form.register("shade")}
            />
            <datalist id="lab-shades">
              {SHADES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <FieldDescription>{t("shadeHint")}</FieldDescription>
          </Field>
          {select("material", t("material"), [
            { value: "", label: t("noMaterial") },
            ...MATERIALS.map((m) => ({ value: m, label: t(`materials.${m}`) })),
          ])}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            id="sentOn"
            type="date"
            dir="ltr"
            max={options.today}
            label={t("sentOn")}
            error={errors.sentOn?.message}
            {...form.register("sentOn", {
              onChange: (e) => setDueFor(form.getValues("labId"), e.target.value),
            })}
          />
          <TextField
            id="dueOn"
            type="date"
            dir="ltr"
            label={t("dueOn")}
            error={errors.dueOn?.message}
            {...form.register("dueOn")}
          />
          <TextField
            id="cost"
            dir="ltr"
            inputMode="numeric"
            label={t("cost")}
            info={t("costHint")}
            optional
            error={errors.cost?.message}
            {...form.register("cost")}
          />
        </div>

        <Field>
          <FieldLabel htmlFor="instructions">
            {t("instructions")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea
            id="instructions"
            rows={2}
            placeholder={t("instructionsPlaceholder")}
            {...form.register("instructions")}
          />
        </Field>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : labCase ? tc("save") : t("send")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

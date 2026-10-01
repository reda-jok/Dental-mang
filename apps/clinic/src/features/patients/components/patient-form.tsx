"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangleIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { TextField } from "@/components/form-field"
import { InfoHint } from "@/components/info-hint"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useValidationMessage, useInvalidHandler } from "@/lib/form"

import { createPatientAction, updatePatientAction } from "../actions"
import { createPatientSchema, updatePatientSchema } from "../schemas"
import type { DuplicateMatch } from "../service"
import { EMPTY_MEDICAL, MedicalQuestionnaire } from "./medical-questionnaire"

/** All fields the form holds (every birth mode's fields at once). */
type FormValues = {
  fullName: string
  gender: "male" | "female" | ""
  birthMode: "date" | "age"
  birthDate: string
  age: string
  phone: string
  phone2: string
  address: string
  referralSource: string
  notes: string
  /** Create only: the intake medical questionnaire. */
  medical?: typeof EMPTY_MEDICAL
}

type Props = { mode: "create" } | { mode: "edit"; patientId: string; initial: FormValues }

const EMPTY: FormValues = {
  fullName: "",
  gender: "",
  birthMode: "age",
  birthDate: "",
  age: "",
  phone: "",
  phone2: "",
  address: "",
  referralSource: "",
  notes: "",
  medical: EMPTY_MEDICAL,
}

export function PatientForm(props: Props) {
  const t = useTranslations("patients")
  const tc = useTranslations("common")
  const router = useRouter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null)

  const schema = props.mode === "create" ? createPatientSchema : updatePatientSchema
  const form = useForm<FormValues>({
    // The schema validates a subset of these fields (per birth mode); types differ on purpose.
    resolver: zodResolver(schema as never) as never,
    mode: "onTouched",
    // The update schema validates the id too, so it must be a form value.
    defaultValues:
      props.mode === "edit" ? ({ ...props.initial, id: props.patientId } as FormValues) : EMPTY,
  })
  const { errors } = form.formState
  const birthMode = useWatch({ control: form.control, name: "birthMode" })
  const gender = useWatch({ control: form.control, name: "gender" })
  const fieldError = (name: keyof FormValues) =>
    (errors as Partial<Record<keyof FormValues, { message?: string }>>)[name]?.message

  const onInvalid = useInvalidHandler()
  const submit = (confirmDuplicate: boolean) =>
    form.handleSubmit(
      () =>
        startTransition(async () => {
          const values = form.getValues()
          if (props.mode === "create") {
            const result = await createPatientAction({ ...values, confirmDuplicate } as never)
            if (!result.ok) return handleError(result, form.setError)
            if (result.data.status === "duplicates") {
              setDuplicates(result.data.matches)
              window.scrollTo({ top: 0, behavior: "smooth" })
              return
            }
            toast.success(t("created"))
            router.push(`/patients/${result.data.id}` as Route)
          } else {
            const result = await updatePatientAction({ ...values, id: props.patientId } as never)
            if (!result.ok) return handleError(result, form.setError)
            toast.success(t("updated"))
            router.push(`/patients/${props.patientId}` as Route)
          }
        }),
      onInvalid,
    )

  return (
    <FormProvider {...form}>
      <form onSubmit={submit(false)} noValidate className="max-w-2xl">
        <FieldGroup>
          {duplicates && duplicates.length > 0 && (
            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>{t("duplicatesTitle")}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{t("duplicatesDescription")}</p>
                <ul className="space-y-1">
                  {duplicates.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.fullName}</span>
                      <span className="text-muted-foreground" dir="ltr">
                        {d.code}
                      </span>
                      {d.phone && (
                        <span className="text-muted-foreground" dir="ltr">
                          {d.phone}
                        </span>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/patients/${d.id}` as Route}>{t("duplicatesOpen")}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button type="button" variant="secondary" disabled={pending} onClick={submit(true)}>
                  {t("duplicatesContinue")}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TextField
            id="fullName"
            label={t("fullName")}
            info={t("fullNameHint")}
            autoComplete="off"
            error={fieldError("fullName")}
            {...form.register("fullName", { onChange: () => setDuplicates(null) })}
          />

          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FieldSet data-invalid={!!fieldError("gender")}>
                <FieldLegend variant="label">{t("gender")}</FieldLegend>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-6"
                  aria-invalid={!!fieldError("gender")}
                >
                  {(["female", "male"] as const).map((g) => (
                    <div key={g} className="flex items-center gap-2">
                      <RadioGroupItem value={g} id={`gender-${g}`} />
                      <Label htmlFor={`gender-${g}`}>{t(g)}</Label>
                    </div>
                  ))}
                </RadioGroup>
                <FieldError>{vm(fieldError("gender"))}</FieldError>
              </FieldSet>
            )}
          />

          <Controller
            control={form.control}
            name="birthMode"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend variant="label">{t("birthMode")}</FieldLegend>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-6"
                >
                  {(
                    [
                      ["age", t("birthModeAge")],
                      ["date", t("birthModeDate")],
                    ] as const
                  ).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-2">
                      <RadioGroupItem value={value} id={`birth-${value}`} />
                      <Label htmlFor={`birth-${value}`}>{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </FieldSet>
            )}
          />

          {birthMode === "date" && (
            <TextField
              id="birthDate"
              type="date"
              dir="ltr"
              label={t("birthDate")}
              error={fieldError("birthDate")}
              className="max-w-48"
              {...form.register("birthDate")}
            />
          )}
          {birthMode === "age" && (
            <TextField
              id="age"
              inputMode="numeric"
              dir="ltr"
              label={t("ageInput")}
              description={t("ageInputHint")}
              error={fieldError("age")}
              className="max-w-32"
              {...form.register("age")}
            />
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              label={t("phone")}
              info={t("phoneHint")}
              placeholder="07701234567"
              error={fieldError("phone")}
              {...form.register("phone", { onChange: () => setDuplicates(null) })}
            />
            <TextField
              id="phone2"
              type="tel"
              inputMode="tel"
              dir="ltr"
              label={t("phone2")}
              optional
              error={fieldError("phone2")}
              {...form.register("phone2")}
            />
          </div>

          <TextField
            id="address"
            label={t("address")}
            optional
            error={fieldError("address")}
            {...form.register("address")}
          />
          <TextField
            id="referralSource"
            label={t("referralSource")}
            optional
            info={t("referralSourceHint")}
            error={fieldError("referralSource")}
            {...form.register("referralSource")}
          />

          <Field data-invalid={!!fieldError("notes")}>
            <FieldLabel htmlFor="notes">
              {t("notes")}{" "}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
              <InfoHint>{t("notesHint")}</InfoHint>
            </FieldLabel>
            <Textarea
              id="notes"
              rows={3}
              aria-invalid={!!fieldError("notes")}
              {...form.register("notes")}
            />
            <FieldDescription className="sr-only">{t("notesHint")}</FieldDescription>
            <FieldError>{vm(fieldError("notes"))}</FieldError>
          </Field>

          {props.mode === "create" && (
            <section className="space-y-4 border-t pt-6" aria-labelledby="medical-heading">
              <div>
                <h2 id="medical-heading" className="text-lg font-semibold">
                  {t("medicalSection")}
                </h2>
                <p className="text-muted-foreground text-sm">{t("medicalSectionHint")}</p>
              </div>
              <MedicalQuestionnaire prefix="medical." gender={gender} />
            </section>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : t("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {tc("cancel")}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}

export type PatientFormValues = FormValues

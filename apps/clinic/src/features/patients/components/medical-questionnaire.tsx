"use client"

import { useTranslations } from "next-intl"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { TextField } from "@/components/form-field"
import { InfoHint } from "@/components/info-hint"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { useValidationMessage } from "@/lib/form"

import { ALLERGIES, MEDICAL_CONDITIONS } from "../medical"

const HINTED = new Set([
  "anticoagulants",
  "endocarditis_risk",
  "bisphosphonates",
  "radiotherapy_head_neck",
])

/** Fields cleared when "none declared" is ticked. */
const ITEM_FIELDS = [
  "conditions",
  "allergies",
  "otherConditions",
  "otherAllergies",
  "medications",
] as const

/**
 * The medical questionnaire, shared by patient registration (prefix "medical.")
 * and the medical-history page (no prefix). Must be inside a react-hook-form
 * <FormProvider>. Answering is required: tick items, or tick "none".
 */
export function MedicalQuestionnaire({
  prefix = "",
  gender,
}: {
  prefix?: "" | "medical."
  gender: "male" | "female" | ""
}) {
  const t = useTranslations("medical")
  const vm = useValidationMessage()
  // Field names are dynamic (prefix), so this component works with an untyped form.
  const form = useFormContext<Record<string, unknown>>()
  const name = (field: string) => `${prefix}${field}`
  const noneDeclared = useWatch({ control: form.control, name: name("noneDeclared") }) === true

  const errorAt = (field: string): string | undefined => {
    let node: unknown = form.formState.errors
    for (const part of name(field).split("."))
      node = (node as Record<string, unknown> | undefined)?.[part]
    return (node as { message?: string } | undefined)?.message
  }

  const clearItems = () => {
    for (const field of ITEM_FIELDS) {
      const empty = field === "conditions" || field === "allergies" ? [] : ""
      form.setValue(name(field), empty, { shouldDirty: true })
    }
  }

  /** A checkbox list bound to an array of codes. Ticking an item un-ticks "none". */
  const checklist = (field: "conditions" | "allergies", items: readonly { code: string }[]) => (
    <Controller
      control={form.control}
      name={name(field)}
      render={({ field: f }) => {
        const selected = new Set<string>((f.value as string[] | undefined) ?? [])
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(({ code }) => {
              const id = `${field}-${code}`
              return (
                <div key={code} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={selected.has(code)}
                    disabled={noneDeclared}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected)
                      if (checked) next.add(code)
                      else next.delete(code)
                      f.onChange([...next])
                      if (checked)
                        form.setValue(name("noneDeclared"), false, { shouldValidate: true })
                    }}
                  />
                  <Label htmlFor={id} className="font-normal">
                    {t(`${field}.${code}` as "conditions.diabetes")}
                  </Label>
                  {HINTED.has(code) && (
                    <InfoHint>
                      {t(`conditionHints.${code}` as "conditionHints.anticoagulants")}
                    </InfoHint>
                  )}
                </div>
              )
            })}
          </div>
        )
      }}
    />
  )

  const noneError = errorAt("noneDeclared")

  return (
    <FieldGroup>
      <Controller
        control={form.control}
        name={name("noneDeclared")}
        render={({ field }) => (
          <Field data-invalid={!!noneError} className="bg-muted/50 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="noneDeclared"
                checked={field.value === true}
                aria-invalid={!!noneError}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true)
                  if (checked === true) clearItems()
                }}
              />
              <div className="grid gap-1">
                <Label htmlFor="noneDeclared">{t("noneDeclared")}</Label>
                <FieldDescription>{t("noneDeclaredHint")}</FieldDescription>
              </div>
            </div>
            <FieldError>{vm(noneError)}</FieldError>
          </Field>
        )}
      />

      <FieldSet disabled={noneDeclared} className={noneDeclared ? "opacity-50" : undefined}>
        <FieldLegend>{t("allergiesLabel")}</FieldLegend>
        {checklist("allergies", ALLERGIES)}
        <TextField
          id="otherAllergies"
          label={t("otherAllergies")}
          optional
          error={errorAt("otherAllergies")}
          {...form.register(name("otherAllergies"))}
        />
      </FieldSet>

      <FieldSet disabled={noneDeclared} className={noneDeclared ? "opacity-50" : undefined}>
        <FieldLegend>{t("conditionsLabel")}</FieldLegend>
        {checklist("conditions", MEDICAL_CONDITIONS)}
        <TextField
          id="otherConditions"
          label={t("otherConditions")}
          optional
          error={errorAt("otherConditions")}
          {...form.register(name("otherConditions"))}
        />
        <Field data-invalid={!!errorAt("medications")}>
          <FieldLabel htmlFor="medications">
            {t("medications")} <InfoHint>{t("medicationsHint")}</InfoHint>
          </FieldLabel>
          <Textarea id="medications" rows={2} {...form.register(name("medications"))} />
          <FieldError>{vm(errorAt("medications"))}</FieldError>
        </Field>
      </FieldSet>

      <div className="flex flex-wrap gap-6">
        {gender === "female" && (
          <Controller
            control={form.control}
            name={name("pregnant")}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pregnant"
                  checked={field.value === true}
                  onCheckedChange={(c) => field.onChange(c === true)}
                />
                <Label htmlFor="pregnant">{t("pregnant")}</Label>
              </div>
            )}
          />
        )}
        <Controller
          control={form.control}
          name={name("smoker")}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="smoker"
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
              />
              <Label htmlFor="smoker">{t("smoker")}</Label>
            </div>
          )}
        />
      </div>

      <Field data-invalid={!!errorAt("notes")}>
        <FieldLabel htmlFor="medicalNotes">
          {t("notes")} <span className="text-muted-foreground font-normal">({t("optional")})</span>
        </FieldLabel>
        <Textarea id="medicalNotes" rows={2} {...form.register(name("notes"))} />
        <FieldError>{vm(errorAt("notes"))}</FieldError>
      </Field>
    </FieldGroup>
  )
}

/** Empty questionnaire values for a new form. */
export const EMPTY_MEDICAL = {
  noneDeclared: false,
  conditions: [] as string[],
  otherConditions: "",
  allergies: [] as string[],
  otherAllergies: "",
  medications: "",
  pregnant: false,
  smoker: false,
  notes: "",
}

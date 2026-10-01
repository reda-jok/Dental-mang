"use client"

import { useTranslations } from "next-intl"
import type { ComponentProps, ReactNode } from "react"

import { InfoHint } from "@/components/info-hint"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useValidationMessage } from "@/lib/form"

type Props = ComponentProps<typeof Input> & {
  id: string
  label: ReactNode
  /** Error message key from Zod (translated here). */
  error?: string
  /** Always-visible helper text (works on touch screens). */
  description?: ReactNode
  /** Extra explanation behind an ⓘ next to the label. */
  info?: ReactNode
  optional?: boolean
}

/** Label + input + description + translated error, wired for accessibility. */
export function TextField({ id, label, error, description, info, optional, ...input }: Props) {
  const t = useTranslations("common")
  const vm = useValidationMessage()
  const describedBy = description && !error ? `${id}-description` : undefined

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">({t("optional")})</span>}
        {info && <InfoHint>{info}</InfoHint>}
      </FieldLabel>
      <Input id={id} aria-invalid={!!error} aria-describedby={describedBy} {...input} />
      {description && !error && (
        <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      )}
      <FieldError>{vm(error)}</FieldError>
    </Field>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useActionErrorHandler, useValidationMessage, useInvalidHandler } from "@/lib/form"

import { setupClinic } from "../actions"
import { setupSchema, type SetupInput } from "../schemas"

export function SetupForm() {
  const t = useTranslations("setup")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()

  const form = useForm<SetupInput>({
    resolver: zodResolver(setupSchema),
    mode: "onTouched",
    defaultValues: {
      clinicName: "",
      ownerName: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  })
  const { errors } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await setupClinic(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("done"))
        router.replace("/login")
      }),
    onInvalid,
  )

  const field = (
    name: keyof SetupInput,
    label: React.ReactNode,
    props: React.ComponentProps<"input"> = {},
    hint?: string,
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
      {hint && !errors[name] && <FieldDescription>{hint}</FieldDescription>}
      <FieldError>{vm(errors[name]?.message)}</FieldError>
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {field(
          "clinicName",
          <>
            {t("clinicName")} <InfoHint>{t("clinicNameHint")}</InfoHint>
          </>,
        )}
        {field(
          "ownerName",
          <>
            {t("ownerName")} <InfoHint>{t("ownerHint")}</InfoHint>
          </>,
          { autoComplete: "name" },
        )}
        {field(
          "username",
          t("username"),
          { dir: "ltr", autoComplete: "username" },
          t("usernameHint"),
        )}
        {field(
          "password",
          t("password"),
          { type: "password", dir: "ltr", autoComplete: "new-password" },
          t("passwordHint"),
        )}
        {field("confirmPassword", t("confirmPassword"), {
          type: "password",
          dir: "ltr",
          autoComplete: "new-password",
        })}
        <Button type="submit" disabled={pending}>
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  )
}

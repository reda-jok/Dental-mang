"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { useValidationMessage, useInvalidHandler } from "@/lib/form"

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "required"),
  password: z.string().min(1, "required"),
})
type LoginInput = z.input<typeof loginSchema>

export function LoginForm() {
  const t = useTranslations("auth")
  const tErrors = useTranslations("errors")
  const router = useRouter()
  const vm = useValidationMessage()
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { username: "", password: "" },
  })
  const { errors } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        setFormError(null)
        const { error } = await authClient.signIn.username(values)
        if (error) {
          if (error.status === 429) setFormError(tErrors("tooManyAttempts"))
          else if (error.status === 401 || error.status === 400)
            setFormError(t("invalidCredentials"))
          else setFormError(tErrors("network"))
          return
        }
        router.replace("/dashboard")
        router.refresh()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={!!errors.username}>
          <FieldLabel htmlFor="username">{t("username")}</FieldLabel>
          <Input
            id="username"
            dir="ltr"
            autoComplete="username"
            autoFocus
            {...form.register("username")}
          />
          <FieldError>{vm(errors.username?.message)}</FieldError>
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            {...form.register("password")}
          />
          <FieldError>{vm(errors.password?.message)}</FieldError>
        </Field>
        <Button type="submit" disabled={pending}>
          {t("login")}
        </Button>
      </FieldGroup>
    </form>
  )
}

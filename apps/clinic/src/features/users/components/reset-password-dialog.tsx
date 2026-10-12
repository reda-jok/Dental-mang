"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { TextField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"

import { allowSignInAction, resetPasswordAction } from "../actions"
import {
  allowSignInSchema,
  resetPasswordSchema,
  type AllowSignInInput,
  type ResetPasswordInput,
} from "../schemas"
import { SignInFields } from "./user-form-dialog"

type Props = {
  user: { id: string; name: string; canSignIn: boolean } | null
  onOpenChange: (open: boolean) => void
}

/** A new password, or for an employee who couldn't sign in, a username and password. */
export function ResetPasswordDialog({ user, onOpenChange }: Props) {
  const t = useTranslations("users")
  const allow = user && !user.canSignIn
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(allow ? "allowSignInTitle" : "resetPasswordTitle", { name: user?.name ?? "" })}
          </DialogTitle>
          <DialogDescription>
            {t(allow ? "allowSignInDescription" : "resetPasswordDescription")}
          </DialogDescription>
        </DialogHeader>
        {user &&
          (allow ? (
            <AllowSignInForm userId={user.id} onDone={() => onOpenChange(false)} />
          ) : (
            <ResetForm userId={user.id} onDone={() => onOpenChange(false)} />
          ))}
      </DialogContent>
    </Dialog>
  )
}

function AllowSignInForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const t = useTranslations("users")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<AllowSignInInput>({
    resolver: zodResolver(allowSignInSchema),
    mode: "onTouched",
    defaultValues: { id: userId, username: "", password: "", confirmPassword: "" },
  })

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await allowSignInAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("signInAllowed"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <SignInFields
          errors={form.formState.errors}
          fields={{
            username: form.register("username"),
            password: form.register("password"),
            confirmPassword: form.register("confirmPassword"),
          }}
        />
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

function ResetForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const t = useTranslations("users")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { id: userId, password: "", confirmPassword: "" },
  })
  const { errors } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await resetPasswordAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("passwordReset"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="new-password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          label={t("password")}
          description={t("passwordHint")}
          error={errors.password?.message}
          {...form.register("password")}
        />
        <TextField
          id="confirm-new-password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          label={t("confirmPassword")}
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

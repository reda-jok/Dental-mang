"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormRegisterReturn,
} from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionErrorHandler, useValidationMessage, useInvalidHandler } from "@/lib/form"
import type { RoleName } from "@/lib/permissions"

import { createUserAction, updateUserAction } from "../actions"
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "../schemas"

type EditTarget = {
  id: string
  name: string
  username: string
  role: RoleName
  nameEn: string | null
  speciality: string | null
  specialityEn: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Roles the current user may assign. */
  assignableRoles: RoleName[]
  /** Present when editing; absent when creating. */
  user?: EditTarget
}

export function UserFormDialog({ open, onOpenChange, assignableRoles, user }: Props) {
  const t = useTranslations("users")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* Remount per open so the form starts fresh each time. */}
        {open &&
          (user ? (
            <EditForm user={user} roles={assignableRoles} onDone={() => onOpenChange(false)} />
          ) : (
            <CreateForm roles={assignableRoles} onDone={() => onOpenChange(false)} />
          ))}
      </DialogContent>
    </Dialog>
  )
}

function RoleField({
  value,
  onChange,
  roles,
  error,
}: {
  value: string
  onChange: (value: string) => void
  roles: RoleName[]
  error?: string
}) {
  const t = useTranslations()
  const vm = useValidationMessage()
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="role">
        {t("users.role")} <InfoHint>{t("users.roleHint")}</InfoHint>
      </FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="role" aria-invalid={!!error}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`roles.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && !error && (
        <FieldDescription>{t(`users.roleDescriptions.${value as RoleName}`)}</FieldDescription>
      )}
      <FieldError>{vm(error)}</FieldError>
    </Field>
  )
}

function CreateForm({ roles, onDone }: { roles: RoleName[]; onDone: () => void }) {
  const t = useTranslations("users")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<CreateUserInput, unknown, z.output<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    mode: "onTouched",
    // Hidden sign-in fields drop out, so an employee who doesn't sign in sends none.
    shouldUnregister: true,
    defaultValues: {
      canSignIn: true,
      name: "",
      nameEn: "",
      speciality: "",
      specialityEn: "",
      username: "",
      role: "reception",
      password: "",
      confirmPassword: "",
    },
  })
  const errors: FieldErrors<Extract<CreateUserInput, { canSignIn: true }>> = form.formState.errors
  const canSignIn = useWatch({ control: form.control, name: "canSignIn" })

  const onInvalid = useInvalidHandler()
  // The server validates again, so send the raw form values (hidden ones are dropped).
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createUserAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("created"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="name"
          label={t("name")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <RoleField
              value={field.value}
              onChange={field.onChange}
              roles={roles}
              error={errors.role?.message}
            />
          )}
        />
        <PrintedFields
          errors={errors}
          fields={{
            nameEn: form.register("nameEn"),
            speciality: form.register("speciality"),
            specialityEn: form.register("specialityEn"),
          }}
        />
        <Controller
          control={form.control}
          name="canSignIn"
          render={({ field }) => (
            <Field className="bg-muted/50 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="canSignIn"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <div className="grid gap-1">
                  <Label htmlFor="canSignIn">{t("canSignIn")}</Label>
                  <FieldDescription>{t("canSignInHint")}</FieldDescription>
                </div>
              </div>
            </Field>
          )}
        />
        {canSignIn && (
          <SignInFields
            errors={errors}
            fields={{
              username: form.register("username"),
              password: form.register("password"),
              confirmPassword: form.register("confirmPassword"),
            }}
          />
        )}
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : t("add")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

type SignInFields = { username: string; password: string; confirmPassword: string }

/** Username and password, for adding someone who signs in or letting them sign in later. */
export function SignInFields({
  errors,
  fields,
}: {
  errors: FieldErrors<SignInFields>
  fields: Record<keyof SignInFields, UseFormRegisterReturn>
}) {
  const t = useTranslations("users")
  return (
    <>
      <TextField
        id="username"
        label={t("username")}
        info={t("usernameHint")}
        dir="ltr"
        autoComplete="off"
        error={errors.username?.message}
        {...fields.username}
      />
      <TextField
        id="password"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        label={t("password")}
        description={t("passwordHint")}
        error={errors.password?.message}
        {...fields.password}
      />
      <TextField
        id="confirmPassword"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        label={t("confirmPassword")}
        error={errors.confirmPassword?.message}
        {...fields.confirmPassword}
      />
    </>
  )
}

function EditForm({
  user,
  roles,
  onDone,
}: {
  user: EditTarget
  roles: RoleName[]
  onDone: () => void
}) {
  const t = useTranslations("users")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  // Keep the current role selectable even if this user couldn't assign it.
  const roleOptions = roles.includes(user.role) ? roles : [user.role, ...roles]

  const form = useForm<UpdateUserInput, unknown, z.output<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    mode: "onTouched",
    defaultValues: {
      id: user.id,
      name: user.name,
      role: user.role,
      nameEn: user.nameEn ?? "",
      speciality: user.speciality ?? "",
      specialityEn: user.specialityEn ?? "",
    },
  })
  const { errors, isDirty } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await updateUserAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("updated"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {user.username && (
          <TextField
            id="username"
            label={t("username")}
            value={user.username}
            dir="ltr"
            disabled
            readOnly
          />
        )}
        <TextField
          id="name"
          label={t("name")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <RoleField
              value={field.value}
              onChange={field.onChange}
              roles={roleOptions}
              error={errors.role?.message}
            />
          )}
        />
        <PrintedFields
          errors={errors}
          fields={{
            nameEn: form.register("nameEn"),
            speciality: form.register("speciality"),
            specialityEn: form.register("specialityEn"),
          }}
        />
        <DialogFooter>
          <Button type="submit" disabled={!isDirty || pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

type PrintedFields = { nameEn?: string; speciality?: string; specialityEn?: string }

/** What prescriptions print under the dentist's name, in Arabic and English. */
function PrintedFields({
  errors,
  fields,
}: {
  errors: FieldErrors<PrintedFields>
  fields: Record<keyof PrintedFields, UseFormRegisterReturn>
}) {
  const t = useTranslations("users")
  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{t("printedTitle")}</legend>
      <p className="text-muted-foreground -mt-1 text-xs">{t("printedHint")}</p>
      <TextField
        id="speciality"
        label={t("speciality")}
        optional
        placeholder={t("specialityPlaceholder")}
        error={errors.speciality?.message}
        {...fields.speciality}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="nameEn"
          label={t("nameEn")}
          optional
          dir="ltr"
          placeholder="Dr. Sara Al-Mousawi"
          error={errors.nameEn?.message}
          {...fields.nameEn}
        />
        <TextField
          id="specialityEn"
          label={t("specialityEn")}
          optional
          dir="ltr"
          placeholder="Orthodontist"
          error={errors.specialityEn?.message}
          {...fields.specialityEn}
        />
      </div>
    </fieldset>
  )
}

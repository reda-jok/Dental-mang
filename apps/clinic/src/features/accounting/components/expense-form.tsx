"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  BanIcon,
  BanknoteIcon,
  LandmarkIcon,
  PlusIcon,
  SmartphoneIcon,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { IconButton } from "@/components/icon-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { cn } from "@/lib/utils"

import { recordExpenseAction, voidExpenseAction } from "../actions"
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, type ExpenseMethod } from "../expenses"
import { recordExpenseSchema, voidExpenseSchema, type RecordExpenseInput } from "../schemas"

const METHOD_ICONS: Record<ExpenseMethod, LucideIcon> = {
  cash: BanknoteIcon,
  wallet: SmartphoneIcon,
  bank: LandmarkIcon,
}

/** "Record an expense": opens the form; every opened form gets its own idempotency key. */
export function ExpenseButton() {
  const t = useTranslations("accounting")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        {t("record")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("recordTitle")}</DialogTitle>
            <DialogDescription>{t("recordDescription")}</DialogDescription>
          </DialogHeader>
          {open && <ExpenseForm onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("accounting")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<RecordExpenseInput, unknown, z.output<typeof recordExpenseSchema>>({
    resolver: zodResolver(recordExpenseSchema),
    mode: "onTouched",
    defaultValues: {
      category: "supplies",
      method: "cash",
      amount: "",
      description: "",
      payee: "",
      reference: "",
      idempotencyKey: crypto.randomUUID(),
    },
  })
  const { errors } = form.formState
  const method = useWatch({ control: form.control, name: "method" })

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await recordExpenseAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("recorded", { number: result.data.number }))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="expenseCategory">{t("category")}</FieldLabel>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="expenseCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="expenseAmount">{t("amount")}</FieldLabel>
          <Input
            id="expenseAmount"
            dir="ltr"
            inputMode="numeric"
            autoFocus
            aria-invalid={!!errors.amount}
            {...form.register("amount")}
          />
          <FieldError>{vm(errors.amount?.message)}</FieldError>
        </Field>

        <Field>
          <FieldLabel id="expense-method-label">{t("method")}</FieldLabel>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-labelledby="expense-method-label"
                className="grid grid-cols-3 gap-2"
              >
                {EXPENSE_METHODS.map((m) => {
                  const Icon = METHOD_ICONS[m]
                  const on = field.value === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => field.onChange(m)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition-colors",
                        on
                          ? "border-primary bg-accent ring-primary ring-1"
                          : "bg-card hover:bg-muted",
                      )}
                    >
                      <Icon className={cn("size-5", on && "text-primary")} />
                      <span className="font-medium">{t(`methods.${m}`)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          />
          <FieldDescription>{t(`methodHints.${method}`)}</FieldDescription>
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="expenseDescription">{t("description")}</FieldLabel>
          <Input
            id="expenseDescription"
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={!!errors.description}
            {...form.register("description")}
          />
          <FieldError>{vm(errors.description?.message)}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.payee}>
            <FieldLabel htmlFor="expensePayee">
              {t("payee")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            </FieldLabel>
            <Input id="expensePayee" {...form.register("payee")} />
            <FieldError>{vm(errors.payee?.message)}</FieldError>
          </Field>
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="expenseReference">
              {t("reference")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            </FieldLabel>
            <Input id="expenseReference" dir="ltr" {...form.register("reference")} />
            <FieldError>{vm(errors.reference?.message)}</FieldError>
          </Field>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : t("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

/** Voids an expense entered by mistake (a reason is required); it stays on the list, crossed out. */
export function ExpenseVoidButton({ id, number }: { id: string; number: string }) {
  const t = useTranslations("accounting.void")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()
  const label = t("label", { number })

  const submit = () => {
    const parsed = voidExpenseSchema.safeParse({ id, reason })
    if (!parsed.success) {
      setError(parsed.error.issues.find((i) => i.path[0] === "reason")?.message)
      return
    }
    startTransition(async () => {
      const result = await voidExpenseAction({ id, reason })
      if (!result.ok) return handleError(result)
      toast.success(t("done", { number }))
      setOpen(false)
    })
  }

  return (
    <>
      <IconButton label={label} className="text-destructive" onClick={() => setOpen(true)}>
        <BanIcon />
      </IconButton>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title", { number })}</AlertDialogTitle>
            <AlertDialogDescription>{t("description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="expenseVoidReason">{t("reason")}</FieldLabel>
            <Textarea
              id="expenseVoidReason"
              rows={2}
              value={reason}
              placeholder={t("reasonPlaceholder")}
              aria-invalid={!!error}
              onChange={(e) => {
                setReason(e.target.value)
                setError(undefined)
              }}
            />
            <FieldError>{vm(error)}</FieldError>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("close")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

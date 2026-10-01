"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BanIcon, ScaleIcon, WalletIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
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
import { Textarea } from "@/components/ui/textarea"
import { MethodPicker } from "@/features/billing/components/method-picker"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatMoney, fromMinor, parseAmount, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"

import { addLabAdjustmentAction, recordLabPaymentAction, voidLabPaymentAction } from "../actions"
import { LAB_ADJUSTMENT_KINDS, LAB_PAYMENT_METHODS } from "../money"
import {
  labAdjustmentSchema,
  labPaymentSchema,
  voidLabPaymentSchema,
  type LabAdjustmentInput,
  type LabPaymentInput,
} from "../schemas"

type LabRef = { id: string; name: string }

/** Pay a lab. `owed` is what the clinic owes it now (negative = credit with the lab). */
export function LabPaymentButton({
  lab,
  owed,
  compact = false,
}: {
  lab: LabRef
  owed: string
  compact?: boolean
}) {
  const t = useTranslations("lab.pay")
  const [open, setOpen] = useState(false)
  return (
    <>
      {compact ? (
        <IconButton label={t("of", { name: lab.name })} onClick={() => setOpen(true)}>
          <WalletIcon />
        </IconButton>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <WalletIcon />
          {t("button")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("title", { name: lab.name })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {/* Remount per open: every opened form gets its own idempotency key. */}
          {open && <LabPaymentForm lab={lab} owed={owed} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LabPaymentForm({ lab, owed, onDone }: { lab: LabRef; owed: string; onDone: () => void }) {
  const t = useTranslations("lab.pay")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const owes = toMinor(owed) > 0n
  const form = useForm<LabPaymentInput, unknown, z.output<typeof labPaymentSchema>>({
    resolver: zodResolver(labPaymentSchema),
    mode: "onTouched",
    defaultValues: {
      labId: lab.id,
      amount: owes ? owed : "",
      method: "cash",
      reference: "",
      notes: "",
      idempotencyKey: crypto.randomUUID(),
    },
  })
  const { errors } = form.formState
  const method = useWatch({ control: form.control, name: "method" })
  const amount = useWatch({ control: form.control, name: "amount" })
  const parsed = parseAmount(amount ?? "", "IQD")
  const extra = parsed ? toMinor(parsed) - (owes ? toMinor(owed) : 0n) : 0n

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await recordLabPaymentAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("recorded", { number: result.data.number }))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <p className="rounded-lg bg-slate-50 p-3 text-sm" aria-live="polite">
          {owes || owed === "0"
            ? t("owedNow", { amount: formatMoney(owed, "IQD") })
            : t("creditNow", { amount: formatMoney(owed.replace("-", ""), "IQD") })}
        </p>

        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="labPayAmount">{t("amount")}</FieldLabel>
          <Input
            id="labPayAmount"
            dir="ltr"
            inputMode="numeric"
            autoFocus
            aria-invalid={!!errors.amount}
            {...form.register("amount")}
          />
          {!errors.amount &&
            (extra > 0n ? (
              <FieldDescription className="text-blue-700">
                {t("overpayHint", { amount: formatMoney(fromMinor(extra), "IQD") })}
              </FieldDescription>
            ) : (
              <FieldDescription>{t("amountHint")}</FieldDescription>
            ))}
          <FieldError>{vm(errors.amount?.message)}</FieldError>
        </Field>

        <Field>
          <FieldLabel id="lab-method-label">{t("method")}</FieldLabel>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <MethodPicker
                value={field.value}
                onChange={field.onChange}
                labelId="lab-method-label"
                methods={LAB_PAYMENT_METHODS}
                label={(m) => t(`methods.${m}`)}
                hint={(m) => t(`methodHints.${m}`)}
              />
            )}
          />
        </Field>

        {method === "wallet" && (
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="labPayReference">
              {t("reference")}
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
              <InfoHint>{t("referenceHint")}</InfoHint>
            </FieldLabel>
            <Input id="labPayReference" dir="ltr" {...form.register("reference")} />
            <FieldError>{vm(errors.reference?.message)}</FieldError>
          </Field>
        )}

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="labPayNotes">
            {t("notes")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea id="labPayNotes" rows={2} {...form.register("notes")} />
          <FieldError>{vm(errors.notes?.message)}</FieldError>
        </Field>

        <DialogFooter>
          <Button type="submit" disabled={pending}>
            <WalletIcon />
            {pending ? tc("saving") : t("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

/** A discount from the lab, or an extra charge not tied to a case. */
export function LabAdjustmentButton({ lab }: { lab: LabRef }) {
  const t = useTranslations("lab.adjust")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ScaleIcon />
        {t("button")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title", { name: lab.name })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {open && <LabAdjustmentForm lab={lab} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LabAdjustmentForm({ lab, onDone }: { lab: LabRef; onDone: () => void }) {
  const t = useTranslations("lab.adjust")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<LabAdjustmentInput, unknown, z.output<typeof labAdjustmentSchema>>({
    resolver: zodResolver(labAdjustmentSchema),
    mode: "onTouched",
    defaultValues: { labId: lab.id, kind: "discount", amount: "", reason: "" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await addLabAdjustmentAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("saved"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel id="adjust-kind-label">{t("kind")}</FieldLabel>
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-labelledby="adjust-kind-label"
                className="grid grid-cols-2 gap-2"
              >
                {LAB_ADJUSTMENT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={field.value === kind}
                    onClick={() => field.onChange(kind)}
                    className={cn(
                      "rounded-xl border p-3 text-center transition-colors",
                      field.value === kind
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <span className="block text-sm font-medium">{t(`kinds.${kind}`)}</span>
                    <span className="block text-xs text-slate-500">{t(`kindHints.${kind}`)}</span>
                  </button>
                ))}
              </div>
            )}
          />
        </Field>
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="adjustAmount">{t("amount")}</FieldLabel>
          <Input
            id="adjustAmount"
            dir="ltr"
            inputMode="numeric"
            aria-invalid={!!errors.amount}
            {...form.register("amount")}
          />
          <FieldError>{vm(errors.amount?.message)}</FieldError>
        </Field>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="adjustReason">{t("reason")}</FieldLabel>
          <Textarea
            id="adjustReason"
            rows={2}
            placeholder={t("reasonPlaceholder")}
            aria-invalid={!!errors.reason}
            {...form.register("reason")}
          />
          <FieldError>{vm(errors.reason?.message)}</FieldError>
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : t("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

/** Void a lab payment entered by mistake (needs the void permission). */
export function LabPaymentVoidButton({
  id,
  number,
  allowed,
}: {
  id: string
  number: string
  allowed: boolean
}) {
  const t = useTranslations("lab.voidPayment")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()
  const label = t("label", { number })

  if (!allowed) {
    return (
      <IconButton label={label} disabledReason={t("noPermission")}>
        <BanIcon />
      </IconButton>
    )
  }

  const submit = () => {
    const parsed = voidLabPaymentSchema.safeParse({ id, reason })
    if (!parsed.success) {
      setError(parsed.error.issues.find((i) => i.path[0] === "reason")?.message)
      return
    }
    startTransition(async () => {
      const result = await voidLabPaymentAction({ id, reason })
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
            <FieldLabel htmlFor="labVoidReason">{t("reason")}</FieldLabel>
            <Textarea
              id="labVoidReason"
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

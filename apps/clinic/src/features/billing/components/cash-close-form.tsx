"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  CheckCircle2Icon,
  LandmarkIcon,
  LockKeyholeIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatMoney, parseAmount, subtractAmounts, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"

import { closeCashAction } from "../actions"
import { CASH_TAKEN_TO, closeOutcome } from "../cash"
import { closeCashSchema, type CloseCashInput } from "../schemas"

/**
 * Count the drawer, see the difference live, take cash out (to the owner or the bank) or
 * leave it for the next close, and close (with a confirmation).
 */
export function CashCloseForm({ expected }: { expected: string }) {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  const form = useForm<CloseCashInput, unknown, z.output<typeof closeCashSchema>>({
    resolver: zodResolver(closeCashSchema),
    mode: "onTouched",
    defaultValues: { counted: "", takenOut: "", takenTo: undefined, notes: "" },
  })
  const { errors } = form.formState
  const counted = parseAmount(useWatch({ control: form.control, name: "counted" }) ?? "", "IQD")
  const outcome = counted === null ? null : closeOutcome(counted, expected)
  const takenOutRaw = useWatch({ control: form.control, name: "takenOut" }) ?? ""
  const takenOut = takenOutRaw.trim() ? parseAmount(takenOutRaw, "IQD") : "0"
  const takenTo = useWatch({ control: form.control, name: "takenTo" })
  const taking = takenOut !== null && toMinor(takenOut) > 0n
  const kept =
    counted !== null && takenOut !== null && toMinor(takenOut) <= toMinor(counted)
      ? subtractAmounts(counted, takenOut)
      : null

  const submit = () =>
    startTransition(async () => {
      const result = await closeCashAction(form.getValues())
      setConfirming(false)
      if (!result.ok) return handleError(result, form.setError)
      toast.success(t("cashClosed"))
    })

  return (
    <form
      onSubmit={form.handleSubmit(() => {
        // A difference needs a note; say so before asking for confirmation.
        if (outcome && outcome.kind !== "match" && !form.getValues("notes")?.trim()) {
          form.setError("notes", { message: "differenceNeedsNote" })
          return
        }
        setConfirming(true)
      }, onInvalid)}
      noValidate
      className="max-w-xl"
    >
      <FieldGroup>
        <Field data-invalid={!!errors.counted}>
          <FieldLabel htmlFor="counted">{t("counted")}</FieldLabel>
          <Input
            id="counted"
            dir="ltr"
            inputMode="numeric"
            className="text-lg"
            aria-invalid={!!errors.counted}
            {...form.register("counted")}
          />
          {!errors.counted && <FieldDescription>{t("countedHint")}</FieldDescription>}
          <FieldError>{vm(errors.counted?.message)}</FieldError>
        </Field>

        {outcome && (
          <p
            aria-live="polite"
            data-outcome={outcome.kind}
            className={cn(
              "flex items-center gap-2 rounded-lg p-3 text-sm font-medium",
              outcome.kind === "match" && "bg-green-50 text-green-700",
              outcome.kind === "over" && "bg-blue-50 text-blue-700",
              outcome.kind === "short" && "bg-red-50 text-red-700",
            )}
          >
            {outcome.kind === "match" ? (
              <CheckCircle2Icon className="size-4" aria-hidden />
            ) : (
              <TriangleAlertIcon className="size-4" aria-hidden />
            )}
            {outcome.kind === "match"
              ? t("outcome.match")
              : t(`outcome.${outcome.kind}`, {
                  amount: formatMoney(outcome.difference.replace("-", ""), "IQD"),
                })}
          </p>
        )}

        <Field data-invalid={!!errors.takenOut}>
          <FieldLabel htmlFor="takenOut">
            {t("takenOut")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id="takenOut"
              dir="ltr"
              inputMode="numeric"
              aria-invalid={!!errors.takenOut}
              {...form.register("takenOut")}
            />
            <Button
              type="button"
              variant="outline"
              disabled={counted === null}
              onClick={() => form.setValue("takenOut", counted ?? "", { shouldValidate: true })}
            >
              {t("takeAll")}
            </Button>
          </div>
          {!errors.takenOut && <FieldDescription>{t("takenOutHint")}</FieldDescription>}
          <FieldError>{vm(errors.takenOut?.message)}</FieldError>
        </Field>

        {taking && (
          <Field data-invalid={!!errors.takenTo}>
            <FieldLabel id="taken-to-label">{t("takenTo")}</FieldLabel>
            <Controller
              control={form.control}
              name="takenTo"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-labelledby="taken-to-label"
                  className="grid grid-cols-2 gap-2"
                >
                  {CASH_TAKEN_TO.map((to) => {
                    const Icon = to === "owner" ? UserRoundIcon : LandmarkIcon
                    const on = field.value === to
                    return (
                      <button
                        key={to}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => field.onChange(to)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                          on
                            ? "border-primary bg-accent ring-primary ring-1"
                            : "bg-card hover:bg-muted",
                        )}
                      >
                        <Icon className={cn("size-4", on && "text-primary")} aria-hidden />
                        {t(`takenToOptions.${to}`)}
                      </button>
                    )
                  })}
                </div>
              )}
            />
            <FieldError>{vm(errors.takenTo?.message)}</FieldError>
          </Field>
        )}

        {kept !== null && (
          <p className="text-muted-foreground text-sm" data-testid="kept-after">
            {t("keptAfter", { amount: formatMoney(kept, "IQD") })}
          </p>
        )}

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="closeNotes">
            {t("closeNotes")}
            {(!outcome || outcome.kind === "match") && (
              <span className="text-muted-foreground font-normal">({tc("optional")})</span>
            )}
          </FieldLabel>
          <Textarea
            id="closeNotes"
            rows={2}
            placeholder={t("closeNotesPlaceholder")}
            aria-invalid={!!errors.notes}
            {...form.register("notes")}
          />
          <FieldError>{vm(errors.notes?.message)}</FieldError>
        </Field>

        <div>
          <Button type="submit" disabled={pending}>
            <LockKeyholeIcon />
            {t("closeDrawer")}
          </Button>
        </div>
      </FieldGroup>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("closeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("closeConfirmDescription", {
                expected: formatMoney(expected, "IQD"),
                counted: formatMoney(counted ?? "0", "IQD"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {taking && takenTo && (
            <p className="text-sm font-medium">
              {t("closeConfirmTakeout", {
                amount: formatMoney(takenOut, "IQD"),
                to: t(`takenToOptions.${takenTo}`),
              })}
            </p>
          )}
          {kept !== null && (
            <p className="text-muted-foreground text-sm">
              {t("keptAfter", { amount: formatMoney(kept, "IQD") })}
            </p>
          )}
          {outcome && outcome.kind !== "match" && (
            <p className="text-sm font-medium text-red-700">
              {t(`outcome.${outcome.kind}`, {
                amount: formatMoney(outcome.difference.replace("-", ""), "IQD"),
              })}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("close")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {t("closeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

"use client"

import { BanIcon, CheckCheckIcon, PackageCheckIcon, RotateCcwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InfoHint } from "@/components/info-hint"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addDays } from "@/lib/dates"
import { useActionErrorHandler, useValidationMessage } from "@/lib/form"
import { formatMoney } from "@/lib/money"

import { stepLabCaseAction } from "../actions"
import type { LabCaseView } from "../data"
import { actionsFor, type LabAction, type LabStatus } from "../rules"
import { labCaseStepSchema } from "../schemas"

const ICONS = {
  receive: PackageCheckIcon,
  fit: CheckCheckIcon,
  remake: RotateCcwIcon,
  cancel: BanIcon,
} as const

/** The next steps for a case, each confirmed in a small dialog (date / reason). */
export function LabCaseSteps({ labCase, today }: { labCase: LabCaseView; today: string }) {
  const t = useTranslations("lab")
  const [action, setAction] = useState<LabAction | null>(null)
  const actions = actionsFor(labCase.status as LabStatus)
  if (actions.length === 0) return null
  return (
    <>
      {actions.map((a) => {
        const Icon = ICONS[a]
        return (
          <IconButton
            key={a}
            label={t(`steps.${a}`, { number: labCase.number })}
            onClick={() => setAction(a)}
            className={
              a === "cancel" ? "text-destructive" : a === "fit" ? "text-green-700" : undefined
            }
          >
            <Icon />
          </IconButton>
        )
      })}
      <Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          {action && (
            <StepForm
              labCase={labCase}
              action={action}
              today={today}
              onDone={() => setAction(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function StepForm({
  labCase,
  action,
  today,
  onDone,
}: {
  labCase: LabCaseView
  action: LabAction
  today: string
  onDone: () => void
}) {
  const t = useTranslations("lab")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [date, setDate] = useState(action === "remake" ? addDays(today, 5) : today)
  const [reason, setReason] = useState("")
  // What the lab charges, confirmed when the work first comes back (then it's the lab's bill).
  const [cost, setCost] = useState(labCase.cost === "0" ? "" : labCase.cost)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const billed = !!labCase.billedOn

  const input =
    action === "receive"
      ? { action, id: labCase.id, date, cost: billed ? "" : cost }
      : action === "fit"
        ? { action, id: labCase.id, date }
        : action === "remake"
          ? { action, id: labCase.id, dueOn: date, reason }
          : { action, id: labCase.id, reason }

  const submit = () => {
    const parsed = labCaseStepSchema.safeParse(input)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    startTransition(async () => {
      const result = await stepLabCaseAction(input as never)
      if (!result.ok) return handleError(result)
      toast.success(t(`stepDone.${action}`))
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(`steps.${action}`, { number: labCase.number })}</DialogTitle>
        <DialogDescription>
          {labCase.patient.fullName} · {labCase.work} · {labCase.labName}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {action !== "cancel" && (
          <Field data-invalid={!!errors.date || !!errors.dueOn}>
            <FieldLabel htmlFor="stepDate">
              {action === "remake" ? t("newDueOn") : t(`stepDate.${action}`)}
            </FieldLabel>
            <Input
              id="stepDate"
              type="date"
              dir="ltr"
              value={date}
              max={action === "remake" ? undefined : today}
              onChange={(e) => setDate(e.target.value)}
            />
            <FieldError>{vm(errors.date ?? errors.dueOn)}</FieldError>
          </Field>
        )}
        {action === "receive" &&
          (billed ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {t("receiveBilledNote", { amount: formatMoney(labCase.cost, "IQD") })}
            </p>
          ) : (
            <Field data-invalid={!!errors.cost}>
              <FieldLabel htmlFor="stepCost">
                {t("receiveCost")}
                <InfoHint>{t("costHint")}</InfoHint>
              </FieldLabel>
              <Input
                id="stepCost"
                dir="ltr"
                inputMode="numeric"
                value={cost}
                aria-invalid={!!errors.cost}
                onChange={(e) => setCost(e.target.value)}
              />
              {!errors.cost && <FieldDescription>{t("receiveCostHint")}</FieldDescription>}
              <FieldError>{vm(errors.cost)}</FieldError>
            </Field>
          ))}
        {(action === "remake" || action === "cancel") && (
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="stepReason">{t(`stepReason.${action}`)}</FieldLabel>
            <Textarea
              id="stepReason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(`stepReasonPlaceholder.${action}`)}
            />
            <FieldError>{vm(errors.reason)}</FieldError>
          </Field>
        )}
        <DialogFooter>
          <Button
            variant={action === "cancel" ? "destructive" : "default"}
            disabled={pending}
            onClick={submit}
          >
            {pending ? tc("saving") : t(`stepConfirm.${action}`)}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </>
  )
}

"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useActionErrorHandler } from "@/lib/form"
import { cn } from "@/lib/utils"
import { completedMessage } from "@/lib/whatsapp"

import { finishOptionsAction, finishVisitAction } from "../actions"
import type { AppointmentView, FinishOption } from "../data"
import { itemLabel, visitPurpose } from "../display"
import { finishProblem, type VisitOutcome } from "../rules"
import { VISIT_OUTCOMES } from "../schemas"
import { useBooking } from "./booking-provider"

/**
 * "إنهاء": the dentist says what happened to each treatment booked for the visit (done,
 * needs another visit, not done today), and can record other open treatments of the plan.
 * A visit where nothing was done finishes only as a check-up or consultation.
 */
export function FinishVisitDialog({
  visit,
  open,
  onOpenChange,
}: {
  visit: AppointmentView
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("appointments.finish")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: visit.patient.fullName })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {open && <FinishForm visit={visit} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function FinishForm({ visit, onDone }: { visit: AppointmentView; onDone: () => void }) {
  const t = useTranslations("appointments")
  const tf = useTranslations("appointments.finish")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const { openWhatsApp, config } = useBooking()
  const [pending, startTransition] = useTransition()
  const [options, setOptions] = useState<FinishOption[] | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string, VisitOutcome>>({})
  const [noTreatment, setNoTreatment] = useState(false)

  useEffect(() => {
    let cancelled = false
    void finishOptionsAction({ id: visit.id }).then((result) => {
      if (!cancelled && result.ok) setOptions(result.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [visit.id])

  if (options === null) return <p className="text-muted-foreground text-sm">{tc("loading")}</p>

  const booked = options.filter((o) => o.booked && o.open)
  const others = options.filter((o) => !o.booked && o.open)
  const doneToday = options.filter((o) => o.doneToday)
  // Something was done today; then "check-up only" no longer applies.
  const worked = doneToday.length > 0 || Object.values(outcomes).some((o) => o !== "not_done")
  const problem = finishProblem({
    open: booked.map((o) => o.id),
    outcomes,
    doneToday: doneToday.length,
    noTreatment: noTreatment && !worked,
  })

  const submit = () =>
    startTransition(async () => {
      const result = await finishVisitAction({
        id: visit.id,
        // Other treatments are only sent when something was done to them.
        outcomes: Object.entries(outcomes)
          .filter(([id, o]) => o !== "not_done" || booked.some((b) => b.id === id))
          .map(([itemId, outcome]) => ({ itemId, outcome })),
        noTreatment: noTreatment && !worked,
      })
      if (!result.ok) return handleError(result)
      toast.success(tf("finished"))
      onDone()
      if (visit.patient.phone) {
        // Offer the "treatment completed" message right away.
        const done = options.filter((o) => outcomes[o.id] === "done" || o.doneToday)
        openWhatsApp({
          kind: "completed",
          phone: visit.patient.phone,
          patientName: visit.patient.fullName,
          message: completedMessage({
            clinicName: config.clinicName,
            patientName: visit.patient.fullName,
            startsAt: visit.startsAt,
            dentistName: visit.dentist?.name,
            procedureName: done.length
              ? done.map(itemLabel).join("، ")
              : visitPurpose(visit, (r) => t(`reasons.${r}`)),
            timeZone: config.timeZone,
          }),
        })
      }
    })

  const set = (id: string, outcome: VisitOutcome) => setOutcomes((o) => ({ ...o, [id]: outcome }))

  return (
    <div className="space-y-5">
      {booked.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{tf("booked")}</h3>
          <ul className="divide-y rounded-xl border">
            {booked.map((o) => (
              <OutcomeRow key={o.id} option={o} value={outcomes[o.id]} onChange={set} />
            ))}
          </ul>
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{tf("doneToday")}</h3>
          <ul className="space-y-1 text-sm">
            {doneToday.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-emerald-600" aria-hidden />
                {itemLabel(o)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <details className="group rounded-xl border" open={booked.length === 0}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
            {tf("others", { count: String(others.length) })}
          </summary>
          <ul className="divide-y border-t">
            {others.map((o) => (
              <OutcomeRow key={o.id} option={o} value={outcomes[o.id]} onChange={set} />
            ))}
          </ul>
        </details>
      )}

      {!worked && (
        <div className="flex items-start gap-2 rounded-lg border p-3">
          <Checkbox
            id="noTreatment"
            checked={noTreatment}
            onCheckedChange={(c) => setNoTreatment(c === true)}
          />
          <div className="grid gap-1">
            <Label htmlFor="noTreatment">{tf("noTreatment")}</Label>
            <p className="text-muted-foreground text-xs">{tf("noTreatmentHint")}</p>
          </div>
        </div>
      )}

      <DialogFooter className="items-center">
        {problem && <p className="text-muted-foreground me-auto text-xs">{tf(problem)}</p>}
        <Button onClick={submit} disabled={pending || !!problem}>
          <CheckIcon />
          {pending ? tc("saving") : tf("submit")}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** One treatment with its three outcomes as large tap targets. */
function OutcomeRow({
  option,
  value,
  onChange,
}: {
  option: FinishOption
  value: VisitOutcome | undefined
  onChange: (id: string, outcome: VisitOutcome) => void
}) {
  const tf = useTranslations("appointments.finish")
  const tb = useTranslations("appointments.form")
  const label = itemLabel(option)
  return (
    <li className="space-y-2 p-3" data-item={label}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {option.name}
          {option.tooth !== null && (
            <span className="ms-1">
              <bdi className="font-mono">
                {option.tooth}
                {option.surfaces.join("")}
              </bdi>
            </span>
          )}
        </span>
        {option.visitsMax > 1 && (
          <span className="text-muted-foreground text-xs">
            {tb("visitNumber", {
              n: String(option.visitsSoFar + 1),
              range:
                option.visitsMin === option.visitsMax
                  ? String(option.visitsMax)
                  : `${option.visitsMin}–${option.visitsMax}`,
            })}
          </span>
        )}
      </div>
      <RadioGroup
        value={value ?? ""}
        onValueChange={(v) => onChange(option.id, v as VisitOutcome)}
        aria-label={label}
        className="grid-cols-3 gap-1.5"
      >
        {VISIT_OUTCOMES.map((o) => (
          <Label
            key={o}
            htmlFor={`${option.id}-${o}`}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs",
              value === o && "border-primary bg-accent ring-primary ring-1",
            )}
          >
            <RadioGroupItem value={o} id={`${option.id}-${o}`} />
            {tf(`outcomes.${o}`)}
          </Label>
        ))}
      </RadioGroup>
    </li>
  )
}

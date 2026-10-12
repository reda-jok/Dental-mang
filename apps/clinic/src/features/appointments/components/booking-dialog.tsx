"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { parseIsoDate, todayIso, zonedInstant } from "@/lib/dates"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"
import { formatLocalPhone } from "@/lib/validation"
import { scheduledMessage } from "@/lib/whatsapp"
import type { WhatsAppDraft } from "@/components/whatsapp-dialog"

import { availabilityAction, bookAppointmentAction, bookingItemsAction } from "../actions"
import type { BookingItem, BookingOptions, ScheduleConfig } from "../data"
import { formatTime, itemLabel } from "../display"
import { hhmmToMinutes, nextVisitItems } from "../rules"
import { bookAppointmentSchema, VISIT_REASONS, type BookAppointmentInput } from "../schemas"
import { DayBar } from "./day-bar"

export type BookingPatient = { id: string; fullName: string; phone: string | null }
/** Bookings start from a patient (their page or plan); `planId` ticks that plan's next phase. */
export type BookingPrefill = { patient: BookingPatient; planId?: string }

const NONE = "_none"

type Availability = {
  restDay: boolean
  slots: { time: string; taken: boolean }[]
  bookedCount: number
  bookedPatientIds: string[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: BookingPrefill | null
  options: BookingOptions
  config: ScheduleConfig
  onBooked: (draft: WhatsAppDraft | null) => void
}

export function BookingDialog({ open, onOpenChange, prefill, options, config, onBooked }: Props) {
  const t = useTranslations("appointments.form")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {prefill ? t("description", { name: prefill.patient.fullName }) : null}
          </DialogDescription>
        </DialogHeader>
        {/* Remount per open so every booking starts fresh. */}
        {open && prefill && (
          <BookingForm prefill={prefill} options={options} config={config} onBooked={onBooked} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function BookingForm({
  prefill,
  options,
  config,
  onBooked,
}: Omit<Props, "open" | "onOpenChange"> & { prefill: BookingPrefill }) {
  const t = useTranslations("appointments")
  const tf = useTranslations("appointments.form")
  const tc = useTranslations("common")
  const router = useRouter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()

  const patient = prefill.patient
  const [items, setItems] = useState<BookingItem[] | null>(null)
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  // The last availability answer and the request it answers. "Checking" is derived:
  // the current request differs from the one answered.
  const [loaded, setLoaded] = useState<{ key: string; data: Availability } | null>(null)
  const [durationTouched, setDurationTouched] = useState(false)

  const form = useForm<BookAppointmentInput>({
    resolver: zodResolver(bookAppointmentSchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      patientId: patient.id,
      date: "",
      time: "",
      durationMinutes: config.slotMinutes,
      dentistId: options.dentists.length === 1 ? options.dentists[0]!.id : "",
      roomId: options.rooms.length === 1 ? options.rooms[0]!.id : "",
      itemIds: [],
      reason: "",
      priority: "normal",
      notes: "",
    },
  })
  const { errors } = form.formState
  const [date, durationMinutes, dentistId, roomId, time, itemIds = []] = useWatch({
    control: form.control,
    name: ["date", "durationMinutes", "dentistId", "roomId", "time", "itemIds"],
  })

  // Chair time for the ticked treatments, until the user sets the duration themselves.
  const pickItems = (ids: string[], list = items ?? []) => {
    form.setValue("itemIds", ids)
    if (ids.length > 0) form.setValue("reason", "")
    if (durationTouched) return
    const minutes = list
      .filter((i) => ids.includes(i.id))
      .reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0)
    form.setValue("durationMinutes", Math.min(480, minutes || config.slotMinutes))
  }

  // The patient's unfinished plan treatments; the next phase comes ticked.
  useEffect(() => {
    let cancelled = false
    void bookingItemsAction({ patientId: patient.id }).then((result) => {
      if (cancelled || !result.ok) return
      setItems(result.data)
      pickItems(nextVisitItems(result.data, prefill.planId), result.data)
    })
    return () => {
      cancelled = true
    }
    // Once per booking (the form remounts each time it opens).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Free/taken slots for the chosen day, dentist, room and duration.
  const validDate = !!date && parseIsoDate(String(date)) !== null
  const request = {
    date: String(date ?? ""),
    durationMinutes: Number(durationMinutes) || config.slotMinutes,
    dentistId: dentistId ?? "",
    roomId: roomId ?? "",
  }
  const requestKey = JSON.stringify(request)
  const availability = validDate && loaded?.key === requestKey ? loaded.data : null
  const checking = validDate && loaded?.key !== requestKey

  useEffect(() => {
    if (!validDate) return
    let cancelled = false
    void availabilityAction(JSON.parse(requestKey)).then((result) => {
      if (!cancelled && result.ok) setLoaded({ key: requestKey, data: result.data })
    })
    return () => {
      cancelled = true
    }
  }, [validDate, requestKey])

  // A chosen time that became unavailable is cleared.
  useEffect(() => {
    const time = form.getValues("time")
    if (time && availability?.slots.some((s) => s.time === time && s.taken))
      form.setValue("time", "")
  }, [availability, form])

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = await bookAppointmentAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(tf("booked"))
        router.refresh()

        let draft: WhatsAppDraft | null = null
        if (sendWhatsApp && patient.phone) {
          const startsAt = zonedInstant(
            String(values.date),
            hhmmToMinutes(values.time)!,
            config.timeZone,
          )
          draft = {
            kind: "scheduled",
            phone: patient.phone,
            patientName: patient.fullName,
            message: scheduledMessage({
              clinicName: config.clinicName,
              patientName: patient.fullName,
              startsAt,
              dentistName: options.dentists.find((d) => d.id === values.dentistId)?.name,
              procedureName:
                (items ?? [])
                  .filter((i) => values.itemIds?.includes(i.id))
                  .map(itemLabel)
                  .join("، ") || (values.reason ? t(`reasons.${values.reason}`) : null),
              timeZone: config.timeZone,
            }),
          }
        }
        onBooked(draft)
      }),
    onInvalid,
  )

  const select = (
    name: "reason" | "dentistId" | "roomId" | "priority",
    label: string,
    placeholder: string,
    choices: { value: string; label: string }[],
    optional = true,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!errors[name]}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select
            // A required choice starts empty ("" shows the placeholder).
            value={field.value ? String(field.value) : optional ? NONE : ""}
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
          >
            <SelectTrigger id={name} aria-invalid={!!errors[name]}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {optional && <SelectItem value={NONE}>{placeholder}</SelectItem>}
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{vm(errors[name]?.message)}</FieldError>
        </Field>
      )}
    />
  )

  const closed = availability?.restDay
  const freeSlots = availability?.slots.filter((s) => !s.taken) ?? []
  const patientBooked = availability?.bookedPatientIds.includes(patient.id)

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-5">
        <PlanItemsPicker
          items={items}
          selected={itemIds}
          onChange={(ids) => pickItems(ids)}
          error={vm(errors.itemIds?.message)}
        />
        {items !== null && itemIds.length === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {select(
              "reason",
              tf(items.length > 0 ? "reasonOutsidePlan" : "reason"),
              tf("reasonPlaceholder"),
              VISIT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
              false,
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">{tf("date")}</FieldLabel>
            <Input
              id="date"
              type="date"
              dir="ltr"
              min={todayIso(config.timeZone)}
              {...form.register("date")}
            />
            {closed && (
              <FieldDescription className="text-red-600">{tf("closedDay")}</FieldDescription>
            )}
            {!closed && patientBooked && (
              <FieldDescription className="text-red-600">{tf("patientBooked")}</FieldDescription>
            )}
            <FieldError>{vm(errors.date?.message)}</FieldError>
          </Field>

          <Controller
            control={form.control}
            name="time"
            render={({ field }) => (
              <Field data-invalid={!!errors.time}>
                <FieldLabel htmlFor="time">{tf("time")}</FieldLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!date || closed}
                >
                  <SelectTrigger id="time" aria-invalid={!!errors.time}>
                    <SelectValue placeholder={tf("timePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {availability?.slots.map((slot) => (
                      <SelectItem key={slot.time} value={slot.time} disabled={slot.taken}>
                        {formatTime(slot.time)}
                        {slot.taken && (
                          <span className="text-muted-foreground text-xs"> · {tf("taken")}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {checking ? (
                  <FieldDescription>{tf("checking")}</FieldDescription>
                ) : (
                  availability &&
                  !closed && (
                    <FieldDescription>
                      {freeSlots.length === 0
                        ? tf("noSlots")
                        : tf("slotsBooked", { count: availability.bookedCount })}
                    </FieldDescription>
                  )
                )}
                <FieldError>{vm(errors.time?.message)}</FieldError>
              </Field>
            )}
          />
        </div>

        {availability && !closed && (
          <DayBar
            slots={availability.slots}
            selected={time}
            onPick={(time) =>
              form.setValue("time", time, { shouldValidate: true, shouldTouch: true })
            }
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {select(
            "dentistId",
            tf("dentist"),
            tf("dentistPlaceholder"),
            options.dentists.map((d) => ({ value: d.id, label: d.name })),
          )}
          {options.rooms.length > 0 &&
            select(
              "roomId",
              tf("room"),
              tf("roomPlaceholder"),
              options.rooms.map((r) => ({ value: r.id, label: r.name })),
            )}
          <Field data-invalid={!!errors.durationMinutes}>
            <FieldLabel htmlFor="durationMinutes">
              {tf("duration")} <InfoHint>{tf("durationHint")}</InfoHint>
            </FieldLabel>
            <Input
              id="durationMinutes"
              inputMode="numeric"
              dir="ltr"
              {...form.register("durationMinutes", {
                onChange: () => setDurationTouched(true),
              })}
            />
            <FieldError>{vm(errors.durationMinutes?.message)}</FieldError>
          </Field>
          {select(
            "priority",
            tf("priority"),
            "",
            (["normal", "urgent"] as const).map((p) => ({ value: p, label: t(`priorities.${p}`) })),
            false,
          )}
        </div>

        <Field>
          <FieldLabel htmlFor="notes">
            {tf("notes")}{" "}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea
            id="notes"
            rows={2}
            placeholder={tf("notesPlaceholder")}
            {...form.register("notes")}
          />
        </Field>

        {/* WhatsApp confirmation, as in the clinic's original form */}
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4">
          <Checkbox
            id="sendWhatsApp"
            checked={sendWhatsApp && !!patient.phone}
            disabled={!patient.phone}
            onCheckedChange={(c) => setSendWhatsApp(c === true)}
          />
          <Label htmlFor="sendWhatsApp" className="text-sm font-medium">
            {tf("sendWhatsApp")}
          </Label>
          {patient.phone ? (
            <span className="text-xs text-slate-600" dir="ltr">
              {formatLocalPhone(patient.phone)}
            </span>
          ) : (
            <span className="text-xs text-slate-600">{tf("noPhone")}</span>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={pending || !!closed || items === null}>
            {pending ? tc("saving") : tf("submit")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

/**
 * The plan treatments this visit is for, by plan and phase. Each shows which visit it would
 * be (from the catalog's visit range) and whether a later visit is already booked for it.
 */
function PlanItemsPicker({
  items,
  selected,
  onChange,
  error,
}: {
  items: BookingItem[] | null
  selected: string[]
  onChange: (ids: string[]) => void
  error?: string
}) {
  const tf = useTranslations("appointments.form")
  const format = useFormatter()
  if (items === null) return <p className="text-muted-foreground text-sm">{tf("loadingItems")}</p>
  if (items.length === 0) return null

  const groups = [...new Set(items.map((i) => `${i.planId}|${i.phase}`))]
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((s) => s !== id))
  return (
    <FieldSet data-testid="plan-items">
      <FieldLegend variant="label">{tf("items")}</FieldLegend>
      <FieldDescription>{tf("itemsHint")}</FieldDescription>
      <div className="space-y-3">
        {groups.map((key) => {
          const list = items.filter((i) => `${i.planId}|${i.phase}` === key)
          const first = list[0]!
          return (
            <div key={key} className="rounded-xl border">
              <p className="text-muted-foreground border-b px-3 py-1.5 text-xs font-medium">
                {tf("itemsGroup", { plan: first.planTitle, phase: String(first.phase) })}
              </p>
              <ul className="divide-y">
                {list.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <Checkbox
                        checked={selected.includes(item.id)}
                        onCheckedChange={(c) => toggle(item.id, c === true)}
                        aria-label={itemLabel(item)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{item.name}</span>
                        {item.tooth !== null && (
                          <span className="ms-1">
                            <bdi className="font-mono">
                              {item.tooth}
                              {item.surfaces.join("")}
                            </bdi>
                          </span>
                        )}
                        {item.visitsMax > 1 && (
                          <span className="text-muted-foreground block text-xs">
                            {tf("visitNumber", {
                              n: String(item.visitsSoFar + 1),
                              range:
                                item.visitsMin === item.visitsMax
                                  ? String(item.visitsMax)
                                  : `${item.visitsMin}–${item.visitsMax}`,
                            })}
                          </span>
                        )}
                      </span>
                      {item.bookedOn && (
                        <span className="shrink-0 text-xs text-amber-700">
                          {tf("bookedOn", {
                            date: format.dateTime(parseIsoDate(item.bookedOn)!, {
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            }),
                          })}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <FieldError>{error}</FieldError>
    </FieldSet>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { cn } from "@/lib/utils"
import { scheduledMessage } from "@/lib/whatsapp"

import { formatLocalPhone } from "@/lib/validation"
import { availabilityAction, bookAppointmentAction, searchBookingPatientsAction } from "../actions"
import type { BookingOptions, ScheduleConfig } from "../data"
import { formatTime } from "../display"
import { hhmmToMinutes } from "../rules"
import { bookAppointmentSchema, type BookAppointmentInput } from "../schemas"
import type { WhatsAppDraft } from "@/components/whatsapp-dialog"

export type BookingPatient = { id: string; fullName: string; phone: string | null }
export type BookingPrefill = { date?: string; time?: string; patient?: BookingPatient }

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
  prefill: BookingPrefill
  options: BookingOptions
  config: ScheduleConfig
  onBooked: (draft: WhatsAppDraft | null) => void
}

export function BookingDialog({ open, onOpenChange, prefill, options, config, onBooked }: Props) {
  const t = useTranslations("appointments.form")
  const format = useFormatter()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {prefill.date
              ? t("descriptionDate", {
                  date: format.dateTime(parseIsoDate(prefill.date)!, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }),
                })
              : t("description")}
          </DialogDescription>
        </DialogHeader>
        {/* Remount per open so every booking starts fresh. */}
        {open && (
          <BookingForm prefill={prefill} options={options} config={config} onBooked={onBooked} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function BookingForm({ prefill, options, config, onBooked }: Omit<Props, "open" | "onOpenChange">) {
  const t = useTranslations("appointments")
  const tf = useTranslations("appointments.form")
  const tc = useTranslations("common")
  const router = useRouter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()

  const [patient, setPatient] = useState<BookingPatient | null>(prefill.patient ?? null)
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  // The last availability answer and the request it answers. "Checking" is derived:
  // the current request differs from the one answered.
  const [loaded, setLoaded] = useState<{ key: string; data: Availability } | null>(null)
  const [durationTouched, setDurationTouched] = useState(false)

  const form = useForm<BookAppointmentInput>({
    resolver: zodResolver(bookAppointmentSchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      patientId: prefill.patient?.id ?? "",
      date: prefill.date ?? "",
      time: prefill.time ?? "",
      durationMinutes: config.slotMinutes,
      dentistId: options.dentists.length === 1 ? options.dentists[0]!.id : "",
      roomId: options.rooms.length === 1 ? options.rooms[0]!.id : "",
      procedureId: "",
      priority: "normal",
      notes: "",
    },
  })
  const { errors } = form.formState
  const [date, durationMinutes, dentistId, roomId] = useWatch({
    control: form.control,
    name: ["date", "durationMinutes", "dentistId", "roomId"],
  })

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

  const selectPatient = (p: BookingPatient | null) => {
    setPatient(p)
    form.setValue("patientId", p?.id ?? "", { shouldValidate: !!p })
  }

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = await bookAppointmentAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(tf("booked"))
        router.refresh()

        let draft: WhatsAppDraft | null = null
        if (sendWhatsApp && patient?.phone) {
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
              procedureName: options.procedures.find((p) => p.id === values.procedureId)?.name,
              timeZone: config.timeZone,
            }),
          }
        }
        onBooked(draft)
      }),
    onInvalid,
  )

  const select = (
    name: "procedureId" | "dentistId" | "roomId" | "priority",
    label: string,
    placeholder: string,
    items: { value: string; label: string }[],
    optional = true,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!errors[name]}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select
            value={field.value ? String(field.value) : NONE}
            onValueChange={(v) => {
              field.onChange(v === NONE ? "" : v)
              if (name === "procedureId" && !durationTouched) {
                const minutes = options.procedures.find((p) => p.id === v)?.durationMinutes
                if (minutes) form.setValue("durationMinutes", minutes)
              }
            }}
          >
            <SelectTrigger id={name} aria-invalid={!!errors[name]}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {optional && <SelectItem value={NONE}>{placeholder}</SelectItem>}
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
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

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup className="gap-5">
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

        <PatientPicker
          date={date ? String(date) : ""}
          patient={patient}
          bookedIds={availability?.bookedPatientIds ?? []}
          onSelect={selectPatient}
          error={vm(errors.patientId?.message)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {select(
            "procedureId",
            tf("procedure"),
            tf("procedurePlaceholder"),
            options.procedures.map((p) => ({ value: p.id, label: p.name })),
          )}
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
            checked={sendWhatsApp && !!patient?.phone}
            disabled={!patient?.phone}
            onCheckedChange={(c) => setSendWhatsApp(c === true)}
          />
          <Label htmlFor="sendWhatsApp" className="text-sm font-medium">
            {tf("sendWhatsApp")}
          </Label>
          <span className="text-xs text-slate-600" dir="ltr">
            {patient?.phone ? formatLocalPhone(patient.phone) : patient ? tf("noPhone") : ""}
          </span>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={pending || !!closed}>
            {pending ? tc("saving") : tf("submit")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

/** Patient search; patients already booked on the chosen day are shown red and can't be picked. */
function PatientPicker({
  date,
  patient,
  bookedIds,
  onSelect,
  error,
}: {
  date: string
  patient: BookingPatient | null
  bookedIds: string[]
  onSelect: (p: BookingPatient | null) => void
  error?: string
}) {
  const tf = useTranslations("appointments.form")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<
    (BookingPatient & { code: string; hasAppointment: boolean })[]
  >([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const search = (q: string) => {
    setQuery(q)
    clearTimeout(timer.current)
    if (!q.trim()) return setResults([])
    timer.current = setTimeout(async () => {
      const result = await searchBookingPatientsAction({ q, date: date || undefined })
      if (result.ok) setResults(result.data)
    }, 250)
  }

  const booked = new Set(bookedIds)

  return (
    <Field data-invalid={!!error} className="relative">
      <FieldLabel htmlFor="patientSearch">{tf("patient")}</FieldLabel>
      {patient ? (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
          <span className="flex-1 font-medium">{patient.fullName}</span>
          {booked.has(patient.id) && (
            <span className="text-xs text-red-600">{tf("patientBooked")}</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tf("clearPatient")}
            onClick={() => onSelect(null)}
          >
            <XIcon className="text-red-500" />
          </Button>
        </div>
      ) : (
        <>
          <Input
            id="patientSearch"
            autoComplete="off"
            placeholder={date ? tf("patientSearch") : tf("patientDateFirst")}
            value={query}
            disabled={!date}
            onChange={(e) => search(e.target.value)}
          />
          {query.trim() !== "" && (
            <ul
              role="listbox"
              className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg"
            >
              {results.length === 0 ? (
                <li className="p-2 text-xs text-slate-500">{tf("noPatients")}</li>
              ) : (
                results.map((p) => {
                  const taken = p.hasAppointment || booked.has(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        aria-disabled={taken}
                        disabled={taken}
                        onClick={() => {
                          onSelect(p)
                          setQuery("")
                          setResults([])
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded p-2 text-start text-sm",
                          taken
                            ? "cursor-not-allowed bg-red-100 text-red-800"
                            : "hover:bg-slate-100",
                        )}
                      >
                        <span>
                          {p.fullName}
                          {taken && <span className="ms-2 text-xs">({tf("patientBooked")})</span>}
                        </span>
                        <span className="text-xs text-slate-500" dir="ltr">
                          {p.phone ? formatLocalPhone(p.phone) : p.code}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  )
}

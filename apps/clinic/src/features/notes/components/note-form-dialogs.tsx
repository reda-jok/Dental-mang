"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FilePenLineIcon, NotebookPenIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler, useValidationMessage } from "@/lib/form"

import {
  createClinicalNoteAction,
  deleteClinicalNoteAction,
  reviseClinicalNoteAction,
} from "../actions"
import type { ClinicalNoteFormData, ClinicalNoteView } from "../data"
import type { NoteCheck } from "../rules"
import {
  createClinicalNoteSchema,
  NOTE_MAX_LENGTH,
  reviseClinicalNoteSchema,
  type CreateClinicalNoteInput,
  type ReviseClinicalNoteInput,
} from "../schemas"

const NO_APPOINTMENT = "_none"

/** Dialogs open on the text box, where the writing happens. */
function focusBody(event: Event) {
  event.preventDefault()
  document.getElementById("noteBody")?.focus()
}

export function NewNoteButton({
  patientId,
  data,
}: {
  patientId: string
  data: ClinicalNoteFormData
}) {
  const t = useTranslations("clinicalNotes")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <NotebookPenIcon />
        {t("new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[92svh] overflow-y-auto sm:max-w-2xl"
          onOpenAutoFocus={focusBody}
        >
          <DialogHeader>
            <DialogTitle>{t("new")}</DialogTitle>
            <DialogDescription>{t("newDescription")}</DialogDescription>
          </DialogHeader>
          {open && <NewNoteForm patientId={patientId} data={data} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewNoteForm({
  patientId,
  data,
  onDone,
}: {
  patientId: string
  data: ClinicalNoteFormData
  onDone: () => void
}) {
  const t = useTranslations("clinicalNotes")
  const tc = useTranslations("common")
  const format = useFormatter()
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()

  const todays = data.visits.find((v) => v.date === data.today)
  const form = useForm<CreateClinicalNoteInput, unknown, z.output<typeof createClinicalNoteSchema>>(
    {
      resolver: zodResolver(createClinicalNoteSchema),
      mode: "onTouched",
      defaultValues: { patientId, appointmentId: todays?.id ?? "", body: "" },
    },
  )
  const { errors } = form.formState
  const body = useWatch({ control: form.control, name: "body" })

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createClinicalNoteAction(form.getValues())
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
          <FieldLabel htmlFor="noteVisit">
            {t("visit")}
            <InfoHint>{t("visitHint")}</InfoHint>
          </FieldLabel>
          <Controller
            control={form.control}
            name="appointmentId"
            render={({ field }) => (
              <Select
                value={field.value || NO_APPOINTMENT}
                onValueChange={(v) => field.onChange(v === NO_APPOINTMENT ? "" : v)}
              >
                <SelectTrigger id="noteVisit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_APPOINTMENT}>{t("noAppointment")}</SelectItem>
                  {data.visits.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {[
                        t("visitOption", {
                          date: format.dateTime(v.startsAt, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          }),
                          time: format.dateTime(v.startsAt, { timeStyle: "short" }),
                        }),
                        v.procedureName,
                        v.dentistName,
                      ]
                        .filter(Boolean)
                        .join("، ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <NoteBodyField
          field={form.register("body")}
          value={body}
          error={vm(errors.body?.message)}
        />

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <p className="text-xs text-slate-500">{t("signNotice")}</p>
          <Button type="submit" disabled={pending}>
            <NotebookPenIcon />
            {pending ? tc("saving") : t("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

function NoteBodyField({
  field,
  value,
  error,
}: {
  field: UseFormRegisterReturn<"body">
  value: string | undefined
  error: string | undefined
}) {
  const t = useTranslations("clinicalNotes")
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="noteBody">{t("body")}</FieldLabel>
      <Textarea
        id="noteBody"
        rows={8}
        className="min-h-48"
        placeholder={t("bodyPlaceholder")}
        aria-invalid={!!error}
        maxLength={NOTE_MAX_LENGTH}
        {...field}
      />
      <div className="flex items-start justify-between gap-2">
        <FieldError>{error}</FieldError>
        <span className="ms-auto text-xs text-slate-400" dir="ltr">
          {t("bodyCount", { count: String(value?.length ?? 0), max: String(NOTE_MAX_LENGTH) })}
        </span>
      </div>
    </Field>
  )
}

type NoteForActions = Pick<
  ClinicalNoteView,
  "id" | "version" | "body" | "locked" | "revise" | "remove"
>

/** Correct / amend and delete buttons; disabled ones say why. */
export function NoteActions({ note }: { note: NoteForActions }) {
  const t = useTranslations("clinicalNotes")
  const [editing, setEditing] = useState(false)
  const reviseLabel = note.locked ? t("amend") : t("edit")
  return (
    <>
      <IconButton
        label={reviseLabel}
        disabledReason={blockReason(note.revise, t)}
        onClick={() => setEditing(true)}
      >
        {note.locked ? <FilePenLineIcon /> : <PencilIcon />}
      </IconButton>
      <DeleteNoteButton note={note} />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent
          className="max-h-[92svh] overflow-y-auto sm:max-w-2xl"
          onOpenAutoFocus={focusBody}
        >
          <DialogHeader>
            <DialogTitle>{note.locked ? t("amendTitle") : t("editTitle")}</DialogTitle>
            <DialogDescription>
              {note.locked ? t("amendDescription") : t("editDescription")}
            </DialogDescription>
          </DialogHeader>
          {editing && <ReviseNoteForm note={note} onDone={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReviseNoteForm({ note, onDone }: { note: NoteForActions; onDone: () => void }) {
  const t = useTranslations("clinicalNotes")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<ReviseClinicalNoteInput, unknown, z.output<typeof reviseClinicalNoteSchema>>(
    {
      resolver: zodResolver(reviseClinicalNoteSchema),
      mode: "onTouched",
      defaultValues: { id: note.id, version: note.version, body: note.body },
    },
  )
  const body = useWatch({ control: form.control, name: "body" })

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await reviseClinicalNoteAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("changeSaved"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <NoteBodyField
          field={form.register("body")}
          value={body}
          error={vm(form.formState.errors.body?.message)}
        />
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {note.locked ? <FilePenLineIcon /> : <PencilIcon />}
            {pending ? tc("saving") : t("saveChange")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

function DeleteNoteButton({ note }: { note: NoteForActions }) {
  const t = useTranslations("clinicalNotes")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const remove = () =>
    startTransition(async () => {
      const result = await deleteClinicalNoteAction({ id: note.id })
      if (!result.ok) return handleError(result)
      toast.success(t("deleted"))
      setOpen(false)
    })

  return (
    <>
      <IconButton
        label={t("delete")}
        disabledReason={blockReason(note.remove, t)}
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
      </IconButton>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("close")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                remove()
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function blockReason(check: NoteCheck, t: ReturnType<typeof useTranslations<"clinicalNotes">>) {
  if (check.ok) return null
  return check.reason === "locked" ? t("deleteLocked") : t("notAuthor")
}

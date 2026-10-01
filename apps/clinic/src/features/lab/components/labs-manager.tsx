"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArchiveIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"
import { formatLocalPhone } from "@/lib/validation"

import { archiveLabAction, createLabAction, updateLabAction } from "../actions"
import type { LabRow } from "../data"
import { createLabSchema, type LabInput } from "../schemas"

/** The labs the clinic works with. */
export function LabsManager({ labs, canEdit }: { labs: LabRow[]; canEdit: boolean }) {
  const t = useTranslations("lab")
  const handleError = useActionErrorHandler()
  const [editing, setEditing] = useState<LabRow | "new" | null>(null)
  const [archiving, setArchiving] = useState<LabRow | null>(null)
  const [pending, startTransition] = useTransition()

  const archive = (lab: LabRow) =>
    startTransition(async () => {
      const result = await archiveLabAction({ id: lab.id })
      if (!result.ok) return handleError(result)
      toast.success(t("labArchived"))
      setArchiving(null)
    })

  return (
    <div className="space-y-4">
      {canEdit && (
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("addLab")}
        </Button>
      )}
      {labs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t("noLabs")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {labs.map((lab) => (
            <li
              key={lab.id}
              data-lab={lab.name}
              className={`rounded-xl border border-slate-200 p-4 ${lab.archivedAt ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{lab.name}</p>
                  <p className="text-sm text-slate-500">
                    {lab.contactName}
                    {lab.phone && (
                      <span className="ms-2">
                        <bdi>{formatLocalPhone(lab.phone)}</bdi>
                      </span>
                    )}
                  </p>
                </div>
                {canEdit && !lab.archivedAt && (
                  <span className="flex gap-1">
                    <IconButton
                      label={t("editLab", { name: lab.name })}
                      onClick={() => setEditing(lab)}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label={t("archiveLab", { name: lab.name })}
                      disabledReason={lab.openCases > 0 ? t("labBusy") : null}
                      onClick={() => setArchiving(lab)}
                      className="text-destructive"
                    >
                      <ArchiveIcon />
                    </IconButton>
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{t("openCases", { count: lab.openCases })}</Badge>
                <Badge variant="outline">
                  {t("turnaround", { days: String(lab.turnaroundDays) })}
                </Badge>
                {lab.archivedAt && <Badge variant="secondary">{t("archivedBadge")}</Badge>}
              </p>
              {lab.notes && <p className="mt-2 text-sm text-slate-600">{lab.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? t("addLab") : t("editLabTitle")}</DialogTitle>
            <DialogDescription>{t("labFormDescription")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <LabForm lab={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiving} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archiveLab", { name: archiving?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("archiveLabDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                if (archiving) archive(archiving)
              }}
            >
              {t("archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LabForm({ lab, onDone }: { lab: LabRow | null; onDone: () => void }) {
  const t = useTranslations("lab")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<LabInput, unknown, z.output<typeof createLabSchema>>({
    resolver: zodResolver(createLabSchema),
    mode: "onTouched",
    defaultValues: {
      name: lab?.name ?? "",
      phone: lab?.phone ?? "",
      contactName: lab?.contactName ?? "",
      turnaroundDays: String(lab?.turnaroundDays ?? 7),
      notes: lab?.notes ?? "",
    },
  })
  const { errors } = form.formState
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = lab
          ? await updateLabAction({ ...values, id: lab.id })
          : await createLabAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(lab ? t("labUpdated") : t("labCreated"))
        onDone()
      }),
    onInvalid,
  )
  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="labName"
          label={t("labName")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="labContact"
            label={t("contactName")}
            optional
            error={errors.contactName?.message}
            {...form.register("contactName")}
          />
          <TextField
            id="labPhone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            label={t("phone")}
            optional
            error={errors.phone?.message}
            {...form.register("phone")}
          />
        </div>
        <TextField
          id="labTurnaround"
          dir="ltr"
          inputMode="numeric"
          label={t("turnaroundDays")}
          info={t("turnaroundHint")}
          error={errors.turnaroundDays?.message}
          {...form.register("turnaroundDays")}
        />
        <Field>
          <FieldLabel htmlFor="labNotes">
            {t("notes")}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Textarea id="labNotes" rows={2} {...form.register("notes")} />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

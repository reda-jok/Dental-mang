"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArchiveIcon, PencilIcon, PlusIcon, SparklesIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"

import {
  archiveMedicationAction,
  createMedicationAction,
  loadStarterMedicationsAction,
  updateMedicationAction,
} from "../actions"
import type { MedicationRow } from "../data"
import {
  createMedicationSchema,
  MEDICATION_FORMS,
  MEDICATION_GROUPS,
  type MedicationInput,
} from "../schemas"

/** Settings → Medicines: the list used when writing prescriptions. */
export function MedicationsManager({
  medications,
  canEdit,
}: {
  medications: MedicationRow[]
  canEdit: boolean
}) {
  const t = useTranslations("medications")
  const handleError = useActionErrorHandler()
  const [editing, setEditing] = useState<MedicationRow | "new" | null>(null)
  const [archiving, setArchiving] = useState<MedicationRow | null>(null)
  const [pending, startTransition] = useTransition()

  const loadStarter = () =>
    startTransition(async () => {
      const result = await loadStarterMedicationsAction({})
      if (!result.ok) return handleError(result)
      toast.success(t("starterLoaded"))
    })

  const archive = (m: MedicationRow) =>
    startTransition(async () => {
      const result = await archiveMedicationAction({ id: m.id })
      if (!result.ok) return handleError(result)
      toast.success(t("archived"))
      setArchiving(null)
    })

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            {t("add")}
          </Button>
          {medications.length === 0 && (
            <Button variant="outline" disabled={pending} onClick={loadStarter}>
              <SparklesIcon />
              {t("loadStarter")}
            </Button>
          )}
        </div>
      )}

      {medications.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("name")}</TableHead>
                <TableHead>{t("form")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("instructions")}</TableHead>
                <TableHead>{t("group")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medications.map((m) => (
                <TableRow
                  key={m.id}
                  data-medication={m.name}
                  className={m.archivedAt ? "opacity-50" : ""}
                >
                  <TableCell className="ps-4 font-medium" dir="ltr">
                    <span className="block text-start">{m.name}</span>
                  </TableCell>
                  <TableCell>{t(`forms.${m.form}`)}</TableCell>
                  <TableCell className="hidden text-sm text-slate-600 md:table-cell">
                    {[m.dose, m.frequency, m.duration].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell>
                    {m.group && (
                      <Badge variant="outline">{t(`groups.${m.group as "penicillin"}`)}</Badge>
                    )}
                    {m.archivedAt && <Badge variant="secondary">{t("archivedBadge")}</Badge>}
                  </TableCell>
                  <TableCell>
                    {canEdit && !m.archivedAt && (
                      <span className="flex gap-1">
                        <IconButton
                          label={t("editLabel", { name: m.name })}
                          onClick={() => setEditing(m)}
                        >
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          label={t("archiveLabel", { name: m.name })}
                          onClick={() => setArchiving(m)}
                          className="text-destructive"
                        >
                          <ArchiveIcon />
                        </IconButton>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? t("addTitle") : t("editTitle")}</DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <MedicationForm
              medication={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiving} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("archiveTitle", { name: archiving?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("archiveDescription")}</AlertDialogDescription>
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

function MedicationForm({
  medication,
  onDone,
}: {
  medication: MedicationRow | null
  onDone: () => void
}) {
  const t = useTranslations("medications")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<MedicationInput, unknown, z.output<typeof createMedicationSchema>>({
    resolver: zodResolver(createMedicationSchema),
    mode: "onTouched",
    defaultValues: {
      name: medication?.name ?? "",
      form: medication?.form ?? "tablet",
      dose: medication?.dose ?? "",
      frequency: medication?.frequency ?? "",
      duration: medication?.duration ?? "",
      group: (medication?.group ?? "") as MedicationInput["group"],
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = medication
          ? await updateMedicationAction({ ...values, id: medication.id })
          : await createMedicationAction(values)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t(medication ? "updated" : "created"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="medName"
          dir="ltr"
          label={t("name")}
          description={t("nameHint")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="medForm">{t("form")}</FieldLabel>
            <Controller
              control={form.control}
              name="form"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="medForm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDICATION_FORMS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {t(`forms.${f}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="medGroup">
              {t("group")}
              <InfoHint>{t("groupHint")}</InfoHint>
            </FieldLabel>
            <Controller
              control={form.control}
              name="group"
              render={({ field }) => (
                <Select
                  value={field.value || "_none"}
                  onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                >
                  <SelectTrigger id="medGroup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("noGroup")}</SelectItem>
                    {MEDICATION_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {t(`groups.${g}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
        <TextField
          id="medDose"
          label={t("dose")}
          optional
          placeholder={t("dosePlaceholder")}
          error={errors.dose?.message}
          {...form.register("dose")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="medFrequency"
            label={t("frequency")}
            optional
            placeholder={t("frequencyPlaceholder")}
            error={errors.frequency?.message}
            {...form.register("frequency")}
          />
          <TextField
            id="medDuration"
            label={t("duration")}
            optional
            placeholder={t("durationPlaceholder")}
            error={errors.duration?.message}
            {...form.register("duration")}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

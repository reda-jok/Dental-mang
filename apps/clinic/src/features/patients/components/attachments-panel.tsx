"use client"

import { FileImageIcon, FileTextIcon, PlusIcon, UploadIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition, type DragEvent } from "react"
import { toast } from "sonner"

import { InfoHint } from "@/components/info-hint"
import { Panel } from "@/components/panel"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionErrorHandler } from "@/lib/form"
import { cn } from "@/lib/utils"
import type { ActionResult } from "@/server/errors"

import { removeAttachmentAction } from "../actions"
import { ATTACHMENT_KINDS } from "../attachments"
import type { AttachmentRow } from "../data"

const MAX_BYTES = 15 * 1024 * 1024
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"

type Props = { patientId: string; rows: AttachmentRow[]; canEdit: boolean }

/** X-rays & photos in the clinic's original gallery style, with a dialog for uploads. */
export function AttachmentsPanel({ patientId, rows, canEdit }: Props) {
  const t = useTranslations("files")
  const tc = useTranslations("common")
  const format = useFormatter()
  const router = useRouter()
  const handleError = useActionErrorHandler()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [removing, setRemoving] = useState<AttachmentRow | null>(null)
  const [pending, startTransition] = useTransition()

  const openUpload = (file: File | null = null) => {
    setDroppedFile(file)
    setUploadOpen(true)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && canEdit) openUpload(file)
  }

  const remove = (row: AttachmentRow) =>
    startTransition(async () => {
      const result = await removeAttachmentAction({ id: row.id })
      if (!result.ok) return handleError(result)
      toast.success(t("removed"))
      setRemoving(null)
      router.refresh()
    })

  return (
    <Panel
      icon={FileImageIcon}
      title={t("title")}
      description={t("description")}
      contentClassName="bg-slate-50 p-4 md:p-6"
      actions={
        canEdit && (
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => openUpload()}
          >
            <PlusIcon />
            {t("uploadImage")}
          </Button>
        )
      }
    >
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const url = `/api/attachments/${row.id}`
          const image = row.mimeType.startsWith("image/")
          const date = format.dateTime(new Date(row.takenAt ?? row.createdAt), {
            dateStyle: "medium",
            timeZone: row.takenAt ? "UTC" : undefined,
          })
          return (
            <li
              key={row.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, authenticated file
                  <img
                    src={url}
                    alt={row.notes ?? row.originalName}
                    loading="lazy"
                    className="size-full object-cover opacity-80 grayscale transition-all duration-500 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
                  />
                ) : (
                  <FileTextIcon className="size-14 text-white/60" aria-hidden />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                <div className="absolute start-4 bottom-3 text-start text-white">
                  <p className="font-semibold">{t(`kinds.${row.kind}`)}</p>
                  <p className="text-xs text-white/80">
                    {date}
                    {row.notes && ` · ${row.notes}`}
                  </p>
                </div>
              </a>
              <div className="flex items-center justify-between gap-2 bg-white p-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                >
                  <a href={url} target="_blank" rel="noreferrer">
                    {t("viewFull")}
                  </a>
                </Button>
                {row.uploadedByName && (
                  <span className="truncate text-xs text-slate-400">
                    {t("uploadedBy", { name: row.uploadedByName })}
                  </span>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setRemoving(row)}
                  >
                    {t("remove")}
                  </Button>
                )}
              </div>
            </li>
          )
        })}

        {/* Empty upload slot (click or drop a file) */}
        {canEdit ? (
          <li>
            <button
              type="button"
              onClick={() => openUpload()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "group flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
                dragging
                  ? "border-blue-400 bg-blue-50 text-blue-600"
                  : "border-slate-300 bg-slate-50 text-slate-500 hover:border-blue-400 hover:bg-slate-100 hover:text-blue-600",
              )}
            >
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
                <PlusIcon className="size-6" />
              </span>
              <span className="font-medium">{t("dropHere")}</span>
              <span className="mt-1 text-xs text-slate-400" dir="ltr">
                PNG, JPG, WebP, PDF
              </span>
            </button>
          </li>
        ) : (
          rows.length === 0 && (
            <li className="col-span-full py-10 text-center text-slate-500">
              <p className="font-medium text-slate-700">{t("empty")}</p>
              <p className="text-sm">{t("emptyDescription")}</p>
            </li>
          )
        )}
      </ul>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        patientId={patientId}
        initialFile={droppedFile}
      />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                if (removing) remove(removing)
              }}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}

function UploadDialog({
  open,
  onOpenChange,
  patientId,
  initialFile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  initialFile: File | null
}) {
  const t = useTranslations("files")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("uploadImage")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {/* Remount per open so each upload starts fresh. */}
        {open && (
          <UploadForm
            patientId={patientId}
            initialFile={initialFile}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function UploadForm({
  patientId,
  initialFile,
  onDone,
}: {
  patientId: string
  initialFile: File | null
  onDone: () => void
}) {
  const t = useTranslations("files")
  const te = useTranslations("errors")
  const tc = useTranslations("common")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [file, setFile] = useState<File | null>(initialFile)
  const [kind, setKind] = useState<(typeof ATTACHMENT_KINDS)[number]>("xray")
  const [uploading, setUploading] = useState(false)

  async function upload(form: HTMLFormElement) {
    if (!file) return toast.error(te("fileRequired"))
    if (file.size > MAX_BYTES) return toast.error(te("fileTooLarge"))

    const body = new FormData(form)
    body.set("file", file)
    body.set("patientId", patientId)
    body.set("kind", kind)
    setUploading(true)
    try {
      const res = await fetch("/api/uploads", { method: "POST", body })
      const result = (await res.json()) as ActionResult<{ id: string }>
      if (!result.ok) return handleError(result)
      toast.success(t("uploaded"))
      onDone()
      router.refresh()
    } catch {
      toast.error(te("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void upload(e.currentTarget)
      }}
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="file">{t("file")}</FieldLabel>
          <Input
            id="file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <FieldDescription dir="auto">
              <UploadIcon className="inline size-3" /> {file.name}
            </FieldDescription>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="kind">{t("kind")}</FieldLabel>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="takenAt">
              {t("takenAt")} <InfoHint>{t("takenAtHint")}</InfoHint>
            </FieldLabel>
            <Input id="takenAt" name="takenAt" type="date" dir="ltr" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="notes">
            {t("notes")}{" "}
            <span className="text-muted-foreground font-normal">({tc("optional")})</span>
          </FieldLabel>
          <Input id="notes" name="notes" maxLength={300} />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={uploading || !file}>
            <UploadIcon />
            {uploading ? t("uploading") : t("upload")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

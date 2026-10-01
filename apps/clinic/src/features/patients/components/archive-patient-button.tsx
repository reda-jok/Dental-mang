"use client"

import { ArchiveIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { useActionErrorHandler } from "@/lib/form"

import { archivePatientAction } from "../actions"

export function ArchivePatientButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("patients")
  const tc = useTranslations("common")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const archive = () =>
    startTransition(async () => {
      const result = await archivePatientAction({ id })
      if (!result.ok) return handleError(result)
      toast.success(t("archived"))
      router.replace("/patients" as Route)
    })

  return (
    <>
      <IconButton label={t("archiveTip")} variant="outline" onClick={() => setOpen(true)}>
        <ArchiveIcon />
      </IconButton>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archiveTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("archiveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                archive()
              }}
            >
              {t("archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

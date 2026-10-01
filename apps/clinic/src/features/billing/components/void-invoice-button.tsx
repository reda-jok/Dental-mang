"use client"

import { BanIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useActionErrorHandler, useValidationMessage } from "@/lib/form"

import { voidInvoiceAction } from "../actions"
import { voidInvoiceSchema } from "../schemas"

/** Void with a required reason. Without the permission the button explains who can. */
export function VoidInvoiceButton({
  id,
  number,
  allowed,
}: {
  id: string
  number: string
  allowed: boolean
}) {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()

  if (!allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex"
            aria-label={`${t("void")}: ${t("voidNoPermission")}`}
          >
            <Button variant="outline" disabled>
              <BanIcon />
              {t("void")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("voidNoPermission")}</TooltipContent>
      </Tooltip>
    )
  }

  const submit = () => {
    const parsed = voidInvoiceSchema.safeParse({ id, reason })
    if (!parsed.success) {
      setError(parsed.error.issues.find((i) => i.path[0] === "reason")?.message)
      return
    }
    startTransition(async () => {
      const result = await voidInvoiceAction({ id, reason })
      if (!result.ok) return handleError(result)
      toast.success(t("voided", { number }))
      setOpen(false)
    })
  }

  return (
    <>
      <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        <BanIcon />
        {t("void")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle", { number })}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="voidReason">{t("voidReason")}</FieldLabel>
            <Textarea
              id="voidReason"
              rows={2}
              value={reason}
              placeholder={t("voidReasonPlaceholder")}
              aria-invalid={!!error}
              onChange={(e) => {
                setReason(e.target.value)
                setError(undefined)
              }}
            />
            <FieldError>{vm(error)}</FieldError>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("close")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {t("void")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

"use client"

import { BanIcon } from "lucide-react"
import { useTranslations } from "next-intl"
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
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useActionErrorHandler, useValidationMessage } from "@/lib/form"

import { voidInvoiceAction, voidPaymentAction } from "../actions"
import { voidInvoiceSchema } from "../schemas"

const TEXT = {
  invoice: {
    label: "void",
    title: "voidTitle",
    description: "voidDescription",
    noPermission: "voidNoPermission",
    done: "voided",
  },
  payment: {
    label: "voidPayment",
    title: "voidPaymentTitle",
    description: "voidPaymentDescription",
    noPermission: "voidPaymentNoPermission",
    done: "paymentVoidedToast",
  },
} as const

/**
 * Void an invoice or a payment, with a required reason. Without the permission the
 * button explains who can grant it. `compact` shows an icon button (for table rows).
 */
export function VoidButton({
  kind,
  id,
  number,
  allowed,
  compact = false,
}: {
  kind: "invoice" | "payment"
  id: string
  number: string
  allowed: boolean
  compact?: boolean
}) {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const vm = useValidationMessage()
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()
  const text = TEXT[kind]
  const label = t(text.label, { number })

  if (!allowed) {
    if (compact) {
      return (
        <IconButton label={label} disabledReason={t(text.noPermission)}>
          <BanIcon />
        </IconButton>
      )
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex"
            aria-label={`${label}: ${t(text.noPermission)}`}
          >
            <Button variant="outline" disabled>
              <BanIcon />
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t(text.noPermission)}</TooltipContent>
      </Tooltip>
    )
  }

  const submit = () => {
    // Same rules for both kinds: an id and a reason.
    const parsed = voidInvoiceSchema.safeParse({ id, reason })
    if (!parsed.success) {
      setError(parsed.error.issues.find((i) => i.path[0] === "reason")?.message)
      return
    }
    startTransition(async () => {
      const action = kind === "invoice" ? voidInvoiceAction : voidPaymentAction
      const result = await action({ id, reason })
      if (!result.ok) return handleError(result)
      toast.success(t(text.done, { number }))
      setOpen(false)
    })
  }

  return (
    <>
      {compact ? (
        <IconButton label={label} className="text-destructive" onClick={() => setOpen(true)}>
          <BanIcon />
        </IconButton>
      ) : (
        <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
          <BanIcon />
          {label}
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(text.title, { number })}</AlertDialogTitle>
            <AlertDialogDescription>{t(text.description)}</AlertDialogDescription>
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
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

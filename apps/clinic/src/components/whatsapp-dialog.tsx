"use client"

import { MessageCircleIcon, SendIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { whatsappLink, type WhatsAppKind } from "@/lib/whatsapp"

export type WhatsAppDraft = {
  kind: WhatsAppKind
  phone: string
  patientName: string
  message: string
}

const KIND_STYLE: Record<WhatsAppKind, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  reminder: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-700",
  payment: "bg-red-100 text-red-700",
  custom: "bg-slate-100 text-slate-700",
}

/**
 * Review/edit a WhatsApp message, then open WhatsApp with it (wa.me). `onSent` runs
 * when the user opens WhatsApp (e.g. to log a payment reminder).
 */
export function WhatsAppDialog({
  draft,
  onClose,
  onSent,
}: {
  draft: WhatsAppDraft | null
  onClose: () => void
  onSent?: (draft: WhatsAppDraft) => void
}) {
  const t = useTranslations("appointments.whatsapp")
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {draft && <WhatsAppForm draft={draft} onClose={onClose} onSent={onSent} />}
        {!draft && <DialogTitle className="sr-only">{t("title")}</DialogTitle>}
      </DialogContent>
    </Dialog>
  )
}

function WhatsAppForm({
  draft,
  onClose,
  onSent,
}: {
  draft: WhatsAppDraft
  onClose: () => void
  onSent?: (draft: WhatsAppDraft) => void
}) {
  const t = useTranslations("appointments.whatsapp")
  const [message, setMessage] = useState(draft.message)

  const open = () => {
    window.open(whatsappLink(draft.phone, message), "_blank", "noopener,noreferrer")
    onSent?.({ ...draft, message })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageCircleIcon className="size-5 text-green-600" aria-hidden />
          {t("title")}
          <Badge className={KIND_STYLE[draft.kind]}>{t(`kinds.${draft.kind}`)}</Badge>
        </DialogTitle>
        <DialogDescription>
          {t("to", { name: draft.patientName })} · <span dir="ltr">{draft.phone}</span>
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="wa-message">{t("message")}</FieldLabel>
        <Textarea
          id="wa-message"
          rows={12}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="font-sans text-sm leading-relaxed"
        />
        <FieldDescription>{t("hint")}</FieldDescription>
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("skip")}
        </Button>
        <Button
          onClick={open}
          disabled={!message.trim()}
          className="bg-green-600 hover:bg-green-700"
        >
          <SendIcon />
          {t("open")}
        </Button>
      </DialogFooter>
    </>
  )
}

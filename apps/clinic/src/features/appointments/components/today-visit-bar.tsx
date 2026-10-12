"use client"

import { CalendarCheckIcon, CheckCircle2Icon, PlayIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useActionErrorHandler } from "@/lib/form"

import { setAppointmentStatusAction } from "../actions"
import type { AppointmentView } from "../data"
import { formatTime, STATUS_BADGE, visitPurpose } from "../display"
import { FinishVisitDialog } from "./finish-visit-dialog"

/**
 * Today's visit on every tab of the patient page: Start when the patient sits down, Finish
 * once the dentist has recorded the work (on the chart or the plan, or in the dialog).
 */
export function TodayVisitBar({
  visit,
  canWrite,
  canFinish,
}: {
  visit: AppointmentView
  canWrite: boolean
  canFinish: boolean
}) {
  const t = useTranslations("appointments")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [finishing, setFinishing] = useState(false)

  const start = () =>
    startTransition(async () => {
      const result = await setAppointmentStatusAction({ id: visit.id, status: "in_progress" })
      if (!result.ok) return handleError(result)
      toast.success(t("statusChanged"))
    })

  return (
    <div
      className="bg-accent flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
      data-testid="today-visit"
    >
      <span className="flex flex-wrap items-center gap-2">
        <CalendarCheckIcon className="text-primary size-4" aria-hidden />
        <span className="font-semibold">{t("todayVisit")}</span>
        <bdi>{formatTime(visit.time)}</bdi>
        <span className="text-muted-foreground">
          · {visitPurpose(visit, (r) => t(`reasons.${r}`)) ?? "—"}
          {visit.dentist && ` · ${visit.dentist.name}`}
        </span>
        <Badge className={STATUS_BADGE[visit.status]}>{t(`statuses.${visit.status}`)}</Badge>
      </span>
      {canWrite && visit.status === "pending" && (
        <Button size="sm" disabled={pending} onClick={start}>
          <PlayIcon />
          {t("start")}
        </Button>
      )}
      {canWrite && visit.status === "in_progress" && (
        <IconButton
          label={t("completeTip")}
          disabledReason={canFinish ? null : t("finishNoPermission")}
          variant="default"
          size="sm"
          onClick={() => setFinishing(true)}
        >
          <CheckCircle2Icon />
          {t("complete")}
        </IconButton>
      )}
      {canFinish && (
        <FinishVisitDialog visit={visit} open={finishing} onOpenChange={setFinishing} />
      )}
    </div>
  )
}

"use client"

import {
  BanIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  CheckIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  RotateCcwIcon,
  UndoIcon,
} from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { parseIsoDate } from "@/lib/dates"
import { useActionErrorHandler } from "@/lib/form"
import { formatMoney, fromMinor, subtractAmounts, toMinor } from "@/lib/money"
import { cn } from "@/lib/utils"

import { useBooking } from "../../appointments/components/booking-provider"
import { formatTime } from "../../appointments/display"
import { PrintLink } from "../../printing/components/print-link"
import { chartDentition } from "../../printing/quote"
import { setItemStatusAction, setPlanStatusAction } from "../actions"
import type { PlanView } from "../data"
import { allowedItemStatuses, isPlanOpen, type ItemStatus } from "../rules"
import { PlanMiniChart } from "./plan-mini-chart"

const STATUS_VARIANT = {
  proposed: "outline",
  accepted: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const

type Patient = { id: string; fullName: string; phone: string | null; age: number | null }
type NextVisit = { date: string; time: string; dentistName: string | null }

export function PlansList({
  patient,
  plans,
  canEdit,
  paid,
  nextVisit,
}: {
  patient: Patient
  plans: PlanView[]
  canEdit: boolean
  /** What's been paid towards each plan, for staff who see billing. */
  paid: Record<string, string> | null
  /** The patient's next booked visit; undefined when the user can't see appointments. */
  nextVisit: NextVisit | null | undefined
}) {
  const t = useTranslations("plans")

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">{t("empty")}</p>
        <p className="text-muted-foreground mb-4 text-sm">{t("emptyDescription")}</p>
        <Button asChild variant="outline">
          <Link href={`/patients/${patient.id}/chart` as Route}>{t("openChart")}</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {nextVisit !== undefined && <NextVisitBar patient={patient} visit={nextVisit} />}
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          canEdit={canEdit}
          paid={paid?.[plan.id] ?? null}
          age={patient.age}
        />
      ))}
    </div>
  )
}

function NextVisitBar({ patient, visit }: { patient: Patient; visit: NextVisit | null }) {
  const t = useTranslations("plans")
  const format = useFormatter()
  const { openBooking } = useBooking()
  return (
    <div
      className="bg-accent flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
      data-testid="next-visit"
    >
      <span className="flex items-center gap-2">
        <CalendarClockIcon className="text-primary size-4" />
        {visit ? (
          <span>
            <span className="font-semibold">{t("nextVisit")}:</span>{" "}
            {format.dateTime(parseIsoDate(visit.date)!, {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}{" "}
            <bdi>{formatTime(visit.time)}</bdi>
            {visit.dentistName && ` · ${visit.dentistName}`}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("noNextVisit")}</span>
        )}
      </span>
      {!visit && openBooking && (
        // The booking form ticks the plan's next unfinished phase.
        <Button
          onClick={() =>
            openBooking({
              patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
            })
          }
        >
          <CalendarPlusIcon />
          {t("bookNextVisit")}
        </Button>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  canEdit,
  paid,
  age,
}: {
  plan: PlanView
  canEdit: boolean
  paid: string | null
  age: number | null
}) {
  const t = useTranslations("plans")
  const tp = useTranslations("print")
  const format = useFormatter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const open = isPlanOpen(plan.status)
  const editable = canEdit && open

  const setPlan = (status: "proposed" | "accepted" | "cancelled") =>
    startTransition(async () => {
      const result = await setPlanStatusAction({ planId: plan.id, status })
      if (!result.ok) return handleError(result)
      toast.success(t("statusChanged"))
    })

  const setItem = (itemId: string, status: ItemStatus) =>
    startTransition(async () => {
      const result = await setItemStatusAction({ itemId, status })
      if (!result.ok) return handleError(result)
      toast.success(t(status === "done" ? "markedDone" : "statusChanged"))
    })

  const active = plan.items.filter((i) => i.status !== "cancelled")
  const doneCount = active.filter((i) => i.status === "done").length
  const percent = active.length ? Math.round((doneCount / active.length) * 100) : 0
  const phases = [...new Set(plan.items.map((i) => i.phase))].sort((a, b) => a - b)
  // IQD only (decision D5); the money columns stay per currency for the future.
  const currency = plan.total[0]?.currency ?? "IQD"
  const total = plan.total[0]?.amount ?? "0"
  const done = plan.done[0]?.amount ?? "0"
  const dentition = chartDentition(
    age,
    plan.items.flatMap((i) => (i.tooth === null ? [] : [i.tooth])),
  )
  const money = (amount: string) => <bdi>{formatMoney(amount, currency)}</bdi>

  return (
    <Card data-plan={plan.title}>
      <CardContent className="space-y-5">
        {/* Title, status and what can be done with the plan */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{plan.title}</h3>
              <Badge variant={STATUS_VARIANT[plan.status]}>{t(`statuses.${plan.status}`)}</Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("createdBy", {
                name: plan.createdByName ?? "—",
                date: format.dateTime(plan.createdAt, { dateStyle: "medium" }),
              })}
              {plan.acceptedAt &&
                ` · ${t("acceptedAt", { date: format.dateTime(plan.acceptedAt, { dateStyle: "medium" }) })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintLink href={`/print/quote/${plan.id}`} label={tp("printQuote")} />
            {canEdit && plan.status === "proposed" && (
              <Button disabled={pending} onClick={() => setPlan("accepted")}>
                <CheckCircle2Icon />
                {t("accept")}
              </Button>
            )}
            {canEdit && open && (
              <Button variant="outline" disabled={pending} onClick={() => setPlan("cancelled")}>
                <BanIcon />
                {t("cancel")}
              </Button>
            )}
            {canEdit && plan.status === "cancelled" && (
              <Button variant="outline" disabled={pending} onClick={() => setPlan("proposed")}>
                <RotateCcwIcon />
                {t("reopen")}
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5" data-testid="plan-progress">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {t("progress", { done: String(doneCount), total: String(active.length) })}{" "}
              <InfoHint>{t("statusHint")}</InfoHint>
            </span>
            <span className="text-muted-foreground">{percent}٪</span>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("progressLabel")}
          >
            <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
          </div>
          {open && plan.visitsLeft[1] > 0 && (
            <p className="text-muted-foreground text-xs" data-testid="visits-left">
              {t("visitsLeft", {
                range:
                  plan.visitsLeft[0] === plan.visitsLeft[1]
                    ? String(plan.visitsLeft[1])
                    : `${plan.visitsLeft[0]}–${plan.visitsLeft[1]}`,
              })}{" "}
              <InfoHint>{t("visitsLeftHint")}</InfoHint>
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* The phases as steps, the treatments under each */}
          <ol className="min-w-0 space-y-5">
            {phases.map((phase, p) => {
              const items = plan.items.filter((i) => i.phase === phase)
              const live = items.filter((i) => i.status !== "cancelled")
              const allDone = live.length > 0 && live.every((i) => i.status === "done")
              const phaseTotal = fromMinor(live.reduce((sum, i) => sum + toMinor(i.net), 0n))
              return (
                <li key={phase} className="relative ps-10" data-phase={phase}>
                  <span
                    className={cn(
                      "absolute start-0 top-0 flex size-7 items-center justify-center rounded-full text-sm font-bold",
                      allDone ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {allDone ? <CheckIcon className="size-4" /> : phase}
                  </span>
                  {p < phases.length - 1 && (
                    <span className="bg-border absolute start-3.5 top-8 -bottom-5 w-px" />
                  )}
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-semibold">
                      {t("phaseTitle", { phase: String(phase) })}
                      {allDone && (
                        <span className="ms-2 text-xs font-normal text-emerald-700">
                          {t("phaseDone")}
                        </span>
                      )}
                    </h4>
                    <span className="text-muted-foreground text-xs">
                      {t("phaseCount", {
                        done: String(live.filter((i) => i.status === "done").length),
                        total: String(live.length),
                      })}{" "}
                      · {money(phaseTotal)}
                    </span>
                  </div>
                  <ul className="@container mt-2 divide-y rounded-xl border">
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        editable={editable}
                        pending={pending}
                        onStatus={(s) => setItem(item.id, s)}
                        money={money(item.net)}
                      />
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>

          {/* The mouth and the money */}
          <aside className="space-y-4">
            <PlanMiniChart dentition={dentition} items={plan.items} />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Figure label={t("total")} strong>
                {money(total)}
              </Figure>
              <Figure label={t("doneTotal")}>{money(done)}</Figure>
              {paid !== null ? (
                <>
                  <Figure label={t("paid")}>{money(paid)}</Figure>
                  <Figure label={t("leftToPay")} strong testId="left-to-pay">
                    {money(toMinor(paid) >= toMinor(total) ? "0" : subtractAmounts(total, paid))}
                  </Figure>
                </>
              ) : (
                <Figure label={t("remaining")}>{money(subtractAmounts(total, done))}</Figure>
              )}
            </dl>
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}

/** One treatment: tooth, work, who, price, and one tap to mark it done. */
function ItemRow({
  item,
  editable,
  pending,
  onStatus,
  money,
}: {
  item: PlanView["items"][number]
  editable: boolean
  pending: boolean
  onStatus: (status: ItemStatus) => void
  money: ReactNode
}) {
  const t = useTranslations("plans")
  const format = useFormatter()
  const name = `${item.procedureName}${item.tooth !== null ? ` ${item.tooth}` : ""}`
  const others = allowedItemStatuses(item.status).filter((s) => s !== "done")
  const canFinish = editable && allowedItemStatuses(item.status).includes("done")
  const icon = { planned: UndoIcon, in_progress: PlayIcon, cancelled: BanIcon, done: CheckIcon }
  return (
    <li
      data-item={item.procedureName}
      className={cn(
        "flex flex-col gap-2 p-3 @xl:flex-row @xl:items-center @xl:gap-3",
        item.status === "cancelled" && "text-muted-foreground",
      )}
    >
      {/* Tooth, work and price; on a narrow screen status and buttons go on a second line. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          dir="ltr"
          className={cn(
            "bg-muted min-w-12 rounded-md px-2 py-1 text-center font-mono text-sm font-semibold",
            item.status === "done" && "bg-emerald-50 text-emerald-800",
          )}
        >
          {item.tooth ?? "—"}
          {item.surfaces.length > 0 && (
            <span className="text-muted-foreground ms-0.5 text-xs">{item.surfaces.join("")}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", item.status === "cancelled" && "line-through")}>
            {item.tooth === null
              ? `${item.procedureName} (${t("wholeMouth")})`
              : item.procedureName}
          </p>
          <p className="text-muted-foreground text-xs">
            {item.dentistName ?? t("noDentist")}
            {item.completedAt && item.status === "done" && (
              <>
                {" · "}
                {t("doneOn", { date: format.dateTime(item.completedAt, { dateStyle: "medium" }) })}
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium">{money}</span>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Badge
          variant={item.status === "done" ? "default" : "outline"}
          className={cn(
            item.status === "done" && "bg-emerald-600 text-white",
            item.status === "in_progress" && "border-amber-500 text-amber-700",
          )}
        >
          {t(`itemStatuses.${item.status}`)}
        </Badge>
        {canFinish && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onStatus("done")}
            aria-label={t("markDoneLabel", { name })}
          >
            <CheckIcon />
            {t("markDone")}
          </Button>
        )}
        {editable && others.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("moreActions", { name })} variant="ghost" pending={pending}>
                <EllipsisVerticalIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {others.map((s) => {
                const Icon = icon[s]
                return (
                  <DropdownMenuItem key={s} onSelect={() => onStatus(s)}>
                    <Icon />
                    {t(`itemActions.${s}`)}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  )
}

function Figure({
  label,
  children,
  strong,
  testId,
}: {
  label: string
  children: ReactNode
  strong?: boolean
  testId?: string
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-2.5" data-testid={testId}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("mt-0.5", strong && "font-semibold")}>{children}</dd>
    </div>
  )
}

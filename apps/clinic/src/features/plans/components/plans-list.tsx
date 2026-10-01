"use client"

import { BanIcon, CheckCircle2Icon, RotateCcwIcon } from "lucide-react"
import type { Route } from "next"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionErrorHandler } from "@/lib/form"
import { formatMoney, subtractAmounts, type Currency } from "@/lib/money"

import { PrintLink } from "../../printing/components/print-link"
import { setItemStatusAction, setPlanStatusAction } from "../actions"
import type { PlanView } from "../data"
import { allowedItemStatuses, isPlanOpen, type ItemStatus } from "../rules"

const STATUS_VARIANT = {
  proposed: "outline",
  accepted: "secondary",
  completed: "default",
  cancelled: "destructive",
} as const

export function PlansList({
  patientId,
  plans,
  canEdit,
}: {
  patientId: string
  plans: PlanView[]
  canEdit: boolean
}) {
  const t = useTranslations("plans")

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">{t("empty")}</p>
        <p className="text-muted-foreground mb-4 text-sm">{t("emptyDescription")}</p>
        <Button asChild variant="outline">
          <Link href={`/patients/${patientId}/chart` as Route}>{t("openChart")}</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} canEdit={canEdit} />
      ))}
    </div>
  )
}

function PlanCard({ plan, canEdit }: { plan: PlanView; canEdit: boolean }) {
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
      toast.success(t("statusChanged"))
    })

  const phases = [...new Set(plan.items.map((i) => i.phase))].sort((a, b) => a - b)
  const doneByCurrency = new Map(plan.done.map((d) => [d.currency, d.amount]))

  return (
    <Card data-plan={plan.title} className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{plan.title}</h3>
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
        <div className="flex gap-1">
          <PrintLink href={`/print/quote/${plan.id}`} label={tp("printQuote")} compact />
          {canEdit && (
            <>
              {plan.status === "proposed" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setPlan("accepted")}
                    >
                      <CheckCircle2Icon />
                      {t("accept")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("acceptTip")}</TooltipContent>
                </Tooltip>
              )}
              {open && (
                <IconButton
                  label={t("cancelTip")}
                  variant="outline"
                  pending={pending}
                  onClick={() => setPlan("cancelled")}
                >
                  <BanIcon />
                </IconButton>
              )}
              {plan.status === "cancelled" && (
                <IconButton
                  label={t("reopenTip")}
                  variant="outline"
                  pending={pending}
                  onClick={() => setPlan("proposed")}
                >
                  <RotateCcwIcon />
                </IconButton>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("tooth")}</TableHead>
                <TableHead>{t("procedure")}</TableHead>
                <TableHead className="w-36">{t("price")}</TableHead>
                <TableHead className="w-40">
                  {t("status")} <InfoHint>{t("statusHint")}</InfoHint>
                </TableHead>
                <TableHead className="hidden md:table-cell">{t("dentist")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((phase) => [
                <TableRow key={`phase-${phase}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={5} className="py-1 text-xs font-medium">
                    {t("phase", { phase: String(phase) })}
                  </TableCell>
                </TableRow>,
                ...plan.items
                  .filter((i) => i.phase === phase)
                  .map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        item.status === "cancelled"
                          ? "text-muted-foreground line-through"
                          : undefined
                      }
                    >
                      <TableCell dir="ltr" className="text-end font-mono">
                        {item.tooth ?? "—"}
                        {item.surfaces.length > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            {item.surfaces.join("")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.tooth === null
                          ? `${item.procedureName} (${t("wholeMouth")})`
                          : item.procedureName}
                      </TableCell>
                      <TableCell dir="ltr" className="text-end">
                        {formatMoney(item.net, item.currency)}
                      </TableCell>
                      <TableCell>
                        {editable && allowedItemStatuses(item.status).length > 0 ? (
                          <Select
                            value={item.status}
                            onValueChange={(v) => setItem(item.id, v as ItemStatus)}
                            disabled={pending}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`${t("status")}: ${item.procedureName} ${item.tooth ?? ""}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[item.status, ...allowedItemStatuses(item.status)].map((s) => (
                                <SelectItem key={s} value={s}>
                                  {t(`itemStatuses.${s}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={item.status === "done" ? "default" : "outline"}>
                            {t(`itemStatuses.${item.status}`)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.dentistName ?? "—"}
                      </TableCell>
                    </TableRow>
                  )),
              ])}
            </TableBody>
          </Table>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {plan.total.map(({ currency, amount }) => {
            const done = doneByCurrency.get(currency) ?? "0"
            return (
              <div key={currency} className="contents">
                <Total label={t("total")} amount={amount} currency={currency} strong />
                <Total label={t("doneTotal")} amount={done} currency={currency} />
                <Total
                  label={t("remaining")}
                  amount={subtractAmounts(amount, done)}
                  currency={currency}
                />
              </div>
            )
          })}
        </dl>
      </CardContent>
    </Card>
  )
}

function Total({
  label,
  amount,
  currency,
  strong,
}: {
  label: string
  amount: string
  currency: Currency
  strong?: boolean
}) {
  return (
    <div className="rounded-md border p-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd dir="ltr" className={strong ? "text-end font-semibold" : "text-end"}>
        {formatMoney(amount, currency)}
      </dd>
    </div>
  )
}

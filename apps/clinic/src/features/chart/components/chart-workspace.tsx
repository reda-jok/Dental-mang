"use client"

import {
  CalendarClockIcon,
  CheckIcon,
  ClipboardPlusIcon,
  SettingsIcon,
  StethoscopeIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActionErrorHandler } from "@/lib/form"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

import type { Catalog } from "../../procedures/data"
import { addPlanItemsAction, createPlanAction } from "../../plans/actions"
import { addFindingAction, resolveFindingAction } from "../actions"
import type { ChartData } from "../data"
import { buildChartState, problemsOf, type ToothMark, type ToothState } from "../state"
import type { ConditionInfo, Conditions, Dentition, Surface } from "../teeth"
import { SurfaceDiagram, ToothChart } from "./tooth-chart"

type OpenPlan = { id: string; title: string }

type Props = {
  patientId: string
  data: ChartData
  conditions: ConditionInfo[]
  catalog: Catalog
  openPlans: OpenPlan[]
  canEdit: boolean
  /** May add or change conditions in Settings (a link from the panel). */
  canManageConditions: boolean
  defaultDentition: Dentition
}

export function ChartWorkspace({
  patientId,
  data,
  conditions,
  catalog,
  openPlans,
  canEdit,
  canManageConditions,
  defaultDentition,
}: Props) {
  const t = useTranslations("chart")
  const [dentition, setDentition] = useState<Dentition>(defaultDentition)
  const [teeth, setTeeth] = useState<Set<number>>(new Set())
  const [surfaces, setSurfaces] = useState<Set<Surface>>(new Set())

  const conditionMap = useMemo(() => new Map(conditions.map((c) => [c.code, c])), [conditions])
  const chart = useMemo(
    () => buildChartState(data.findings, data.items, conditionMap),
    [data, conditionMap],
  )

  const toggleTooth = (tooth: number) =>
    setTeeth((prev) => {
      const next = new Set(prev)
      if (next.has(tooth)) next.delete(tooth)
      else next.add(tooth)
      return next
    })

  const clear = () => {
    setTeeth(new Set())
    setSurfaces(new Set())
  }

  const selectedTeeth = [...teeth].sort((a, b) => a - b)

  return (
    // min-w-0: lets the wide chart scroll inside its column instead of widening the page.
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">
            {t("dentition")} <InfoHint>{t("dentitionHint")}</InfoHint>
          </span>
          <RadioGroup
            value={dentition}
            onValueChange={(v) => setDentition(v as Dentition)}
            className="flex gap-4"
          >
            {(["permanent", "mixed", "primary"] as const).map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <RadioGroupItem value={d} id={`dentition-${d}`} />
                <Label htmlFor={`dentition-${d}`}>{t(d)}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="rounded-2xl border bg-slate-50/50 p-4 shadow-sm dark:bg-slate-900/30">
          <ToothChart
            dentition={dentition}
            chart={chart}
            conditions={conditionMap}
            selectedTeeth={teeth}
            onToggleTooth={toggleTooth}
            disabled={!canEdit}
          />
        </div>

        <Legend chart={chart} conditions={conditionMap} />
      </div>

      <div className="min-w-0">
        {selectedTeeth.length === 0 ? (
          <ChartSummary
            chart={chart}
            conditions={conditionMap}
            canEdit={canEdit}
            onPick={(tooth) => {
              setTeeth(new Set([tooth]))
              setSurfaces(new Set())
            }}
          />
        ) : (
          <ToothPanel
            patientId={patientId}
            teeth={selectedTeeth}
            chart={chart}
            conditions={conditionMap}
            surfaces={surfaces}
            setSurfaces={setSurfaces}
            catalog={catalog}
            openPlans={openPlans}
            canManageConditions={canManageConditions}
            onClear={clear}
          />
        )}
      </div>
    </div>
  )
}

const markSurfaces = (mark: { surfaces: Surface[] }, name: (s: Surface) => string) =>
  mark.surfaces.map(name).join("، ")

/** With nothing selected: what needs treatment, what's planned and what's there already. */
function ChartSummary({
  chart,
  conditions,
  canEdit,
  onPick,
}: {
  chart: Map<number, ToothState>
  conditions: Conditions
  canEdit: boolean
  onPick: (tooth: number) => void
}) {
  const t = useTranslations("chart")
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)
  const teeth = [...chart.keys()].sort((a, b) => a - b)
  const problems = teeth.flatMap((tooth) =>
    problemsOf(chart.get(tooth), conditions).map((m) => ({ tooth, mark: m })),
  )
  const existing = teeth.flatMap((tooth) =>
    chart
      .get(tooth)!
      .marks.filter((m) => conditions.get(m.condition)?.kind === "existing")
      .map((m) => ({ tooth, mark: m })),
  )
  const planned = teeth.flatMap((tooth) => chart.get(tooth)!.planned.map((p) => ({ tooth, p })))

  const row = (key: string, tooth: number, color: string | undefined, body: ReactNode) => (
    <li key={key}>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => onPick(tooth)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span
          className="flex h-6 min-w-8 items-center justify-center rounded-md text-xs font-bold text-white"
          style={{ background: color ?? "#2563eb" }}
          dir="ltr"
        >
          {tooth}
        </span>
        <span className="min-w-0 flex-1">{body}</span>
      </button>
    </li>
  )
  const markBody = (mark: ToothMark) => (
    <>
      <span className="font-medium">{conditions.get(mark.condition)?.name}</span>
      {mark.surfaces.length > 0 && (
        <span className="text-muted-foreground ms-1 text-xs">
          · {markSurfaces(mark, surfaceName)}
        </span>
      )}
    </>
  )
  const section = (
    icon: ReactNode,
    title: string,
    count: number,
    items: ReactNode[],
    testId: string,
  ) =>
    count > 0 && (
      <section data-testid={testId}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
          <Badge variant="secondary">{count}</Badge>
        </h3>
        <ul className="space-y-0.5">{items}</ul>
      </section>
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {problems.length + planned.length + existing.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("summaryEmpty")}</p>
        ) : (
          <>
            {section(
              <TriangleAlertIcon className="size-4 text-red-600" />,
              t("needsTreatment"),
              problems.length,
              problems.map(({ tooth, mark }) =>
                row(mark.id, tooth, conditions.get(mark.condition)?.color, markBody(mark)),
              ),
              "needs-treatment",
            )}
            {section(
              <CalendarClockIcon className="size-4 text-blue-600" />,
              t("plannedTitle"),
              planned.length,
              planned.map(({ tooth, p }) =>
                row(
                  p.id,
                  tooth,
                  p.status === "in_progress" ? "#f59e0b" : "#2563eb",
                  <>
                    <span className="font-medium">{p.procedureName}</span>
                    {p.status === "in_progress" && (
                      <span className="text-muted-foreground ms-1 text-xs">
                        · {t("inProgressLegend")}
                      </span>
                    )}
                  </>,
                ),
              ),
              "planned",
            )}
            {section(
              <CheckIcon className="size-4 text-slate-500" />,
              t("existingTitle"),
              existing.length,
              existing.map(({ tooth, mark }) =>
                row(mark.id, tooth, conditions.get(mark.condition)?.color, markBody(mark)),
              ),
              "existing",
            )}
          </>
        )}
        {canEdit && <p className="text-muted-foreground text-xs">{t("noneSelected")}</p>}
      </CardContent>
    </Card>
  )
}

/** The one panel for the selected teeth: surfaces, what's on them, record or plan. */
function ToothPanel({
  patientId,
  teeth,
  chart,
  conditions,
  surfaces,
  setSurfaces,
  catalog,
  openPlans,
  canManageConditions,
  onClear,
}: {
  patientId: string
  teeth: number[]
  chart: Map<number, ToothState>
  conditions: Conditions
  surfaces: Set<Surface>
  setSurfaces: (s: Set<Surface>) => void
  catalog: Catalog
  openPlans: OpenPlan[]
  canManageConditions: boolean
  onClear: () => void
}) {
  const t = useTranslations("chart")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<"finding" | "treatment">("finding")
  const [note, setNote] = useState("")
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)
  const single = teeth.length === 1 ? chart.get(teeth[0]!) : undefined

  const toggleSurface = (surface: Surface) => {
    const next = new Set(surfaces)
    if (next.has(surface)) next.delete(surface)
    else next.add(surface)
    setSurfaces(next)
  }

  const record = (condition: ConditionInfo) =>
    startTransition(async () => {
      const result = await addFindingAction({
        patientId,
        teeth,
        surfaces: condition.scope === "surfaces" ? [...surfaces] : [],
        condition: condition.code,
        notes: note,
      })
      if (!result.ok) return handleError(result)
      toast.success(t("findingSaved"))
      setNote("")
      onClear()
      router.refresh()
    })

  const resolve = (id: string) =>
    startTransition(async () => {
      const result = await resolveFindingAction({ id })
      if (!result.ok) return handleError(result)
      toast.success(t("resolved"))
      router.refresh()
    })

  const offered = [...conditions.values()].filter((c) => !c.hidden)
  const chips = (kind: ConditionInfo["kind"]) => (
    <div className="flex flex-wrap gap-1.5">
      {offered
        .filter((c) => c.kind === kind)
        .map((c) => (
          <Button
            key={c.code}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => record(c)}
            data-condition-chip={c.code}
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
            {c.name}
          </Button>
        ))}
    </div>
  )

  return (
    <Card className="overflow-hidden pt-0" data-testid="tooth-panel">
      {/* Dark "Tooth Details" bar, as in the clinic's original chart */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <h3 className="text-base font-semibold">
          {teeth.length === 1
            ? t("toothLabel", { tooth: String(teeth[0]) })
            : t("teethSelected", { count: teeth.length })}
        </h3>
        <div className="flex items-center gap-2">
          {teeth.length > 1 && (
            <span className="flex flex-wrap justify-end gap-1" dir="ltr">
              {teeth.map((tooth) => (
                <Badge key={tooth}>{tooth}</Badge>
              ))}
            </span>
          )}
          <IconButton
            label={t("clearSelection")}
            onClick={onClear}
            className="text-white! hover:bg-white/10!"
          >
            <XIcon />
          </IconButton>
        </div>
      </div>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-4">
          <SurfaceDiagram
            tooth={teeth[0]!}
            colorOf={() => null}
            selected={surfaces}
            onToggle={toggleSurface}
            labels={surfaceName}
            className="size-28 shrink-0"
          />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              {t("surfacesSelected")} <InfoHint>{t("surfacesPickHint")}</InfoHint>
            </p>
            <p className="text-muted-foreground">
              {surfaces.size ? [...surfaces].map(surfaceName).join("، ") : t("wholeTooth")}
            </p>
          </div>
        </div>

        {single && (single.marks.length > 0 || single.planned.length > 0) && (
          <ul className="space-y-1 border-t pt-3">
            {single.marks.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: conditions.get(m.condition)?.color }}
                  />
                  {conditions.get(m.condition)?.name}
                  {m.surfaces.length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {markSurfaces(m, surfaceName)}
                    </span>
                  )}
                  {m.source === "treatment" && (
                    <span className="text-muted-foreground text-xs">{t("fromTreatment")}</span>
                  )}
                </span>
                {m.source === "finding" && (
                  <IconButton label={t("resolve")} onClick={() => resolve(m.id)} pending={pending}>
                    <CheckIcon />
                  </IconButton>
                )}
              </li>
            ))}
            {single.planned.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <CalendarClockIcon className="size-3.5" />
                {t("plannedOnTooth")}: {p.procedureName}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group">
          {(
            [
              ["finding", StethoscopeIcon, t("modeFinding")],
              ["treatment", ClipboardPlusIcon, t("modeTreatment")],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                mode === value
                  ? "text-steel-700 bg-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {mode === "finding" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">{t("tapToRecord")}</p>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">{t("problemsGroup")}</p>
              {chips("problem")}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-600">{t("existingGroup")}</p>
              {chips("existing")}
            </div>
            <Field>
              <FieldLabel htmlFor="findingNotes" className="text-xs">
                {t("findingNotes")}
              </FieldLabel>
              <Input
                id="findingNotes"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {canManageConditions && (
              <Link
                href={"/settings/conditions" as Route}
                className="text-steel-700 inline-flex items-center gap-1 text-xs hover:underline"
              >
                <SettingsIcon className="size-3.5" />
                {t("manageConditions")}
              </Link>
            )}
          </div>
        ) : (
          <TreatmentForm
            patientId={patientId}
            teeth={teeth}
            surfaces={surfaces}
            catalog={catalog}
            openPlans={openPlans}
            onDone={onClear}
          />
        )}
      </CardContent>
    </Card>
  )
}

function TreatmentForm({
  patientId,
  teeth,
  surfaces,
  catalog,
  openPlans,
  onDone,
}: {
  patientId: string
  teeth: number[]
  surfaces: Set<Surface>
  catalog: Catalog
  openPlans: OpenPlan[]
  onDone: () => void
}) {
  const t = useTranslations("chart")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [planId, setPlanId] = useState<string>(openPlans[0]?.id ?? "new")
  const [newPlanTitle, setNewPlanTitle] = useState("")
  const [procedureId, setProcedureId] = useState<string>("")
  const [phase, setPhase] = useState("1")
  const procedure = catalog.flatMap((c) => c.procedures).find((p) => p.id === procedureId)

  const addToPlan = () =>
    startTransition(async () => {
      let targetPlan = planId
      if (planId === "new") {
        const created = await createPlanAction({
          patientId,
          title: newPlanTitle || t("newPlanDefault"),
        })
        if (!created.ok) return handleError(created)
        targetPlan = created.data.id
        setPlanId(created.data.id)
      }
      const result = await addPlanItemsAction({
        planId: targetPlan,
        procedureId,
        teeth: procedure?.toothScope === "none" ? [] : teeth,
        surfaces: procedure?.toothScope === "surfaces" ? [...surfaces] : [],
        phase: Number(phase),
        notes: "",
      })
      if (!result.ok) return handleError(result)
      toast.success(t("itemsAdded", { count: result.data.count }))
      onDone()
      router.refresh()
    })

  const scopeHint =
    procedure?.toothScope === "none"
      ? t("wholeMouthHint")
      : procedure?.toothScope === "surfaces"
        ? t("surfacesHint")
        : procedure
          ? t("perToothHint")
          : null

  if (catalog.every((c) => c.procedures.length === 0)) {
    return <p className="text-muted-foreground text-sm">{t("catalogEmpty")}</p>
  }
  return (
    <FieldGroup className="gap-3">
      <Field>
        <FieldLabel htmlFor="procedure">{t("procedure")}</FieldLabel>
        <Select value={procedureId} onValueChange={setProcedureId}>
          <SelectTrigger id="procedure">
            <SelectValue placeholder={t("procedurePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {catalog
              .filter((c) => c.procedures.length > 0)
              .map((c) => (
                <SelectGroup key={c.id}>
                  <SelectLabel>{c.name}</SelectLabel>
                  {c.procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      <span className="text-muted-foreground ms-auto text-xs" dir="ltr">
                        {formatMoney(p.price, p.currency)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
          </SelectContent>
        </Select>
        {scopeHint && <FieldDescription>{scopeHint}</FieldDescription>}
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field>
          <FieldLabel htmlFor="plan">{t("plan")}</FieldLabel>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger id="plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {openPlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
              <SelectItem value="new">{t("newPlan")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="phase">
            {t("phase")} <InfoHint>{t("phaseHint")}</InfoHint>
          </FieldLabel>
          <Select value={phase} onValueChange={setPhase}>
            <SelectTrigger id="phase" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {planId === "new" && (
        <Field>
          <FieldLabel htmlFor="newPlanTitle">{t("newPlanTitle")}</FieldLabel>
          <Input
            id="newPlanTitle"
            value={newPlanTitle}
            placeholder={t("newPlanDefault")}
            maxLength={100}
            onChange={(e) => setNewPlanTitle(e.target.value)}
          />
        </Field>
      )}
      <Button
        onClick={addToPlan}
        disabled={pending || !procedure || (procedure.toothScope !== "none" && teeth.length === 0)}
      >
        {t("addItems")}
      </Button>
    </FieldGroup>
  )
}

/** Only what's on this chart, plus the two markers. */
function Legend({ chart, conditions }: { chart: Map<number, ToothState>; conditions: Conditions }) {
  const t = useTranslations("chart")
  const present = new Set([...chart.values()].flatMap((s) => s.marks.map((m) => m.condition)))
  const anyPlanned = [...chart.values()].some((s) => s.planned.length > 0)
  const anyProblem = [...chart.values()].some((s) => problemsOf(s, conditions).length > 0)
  const shown = [...conditions.values()].filter((c) => present.has(c.code))
  if (shown.length === 0 && !anyPlanned) return null
  return (
    <div
      className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-2 rounded-lg border bg-white p-3 text-xs font-medium shadow-sm dark:bg-transparent"
      aria-label={t("legend")}
    >
      {shown.map((c) => (
        <span key={c.code} className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: c.color }} />
          {c.name}
        </span>
      ))}
      {anyProblem && (
        <span className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-red-600 text-white">
            <TriangleAlertIcon className="size-2.5" />
          </span>
          {t("needsTreatment")}
        </span>
      )}
      {anyPlanned && (
        <span className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
            <CalendarClockIcon className="size-2.5" />
          </span>
          {t("plannedLegend")}
          <span className="size-2.5 rounded-full bg-amber-500" />
          {t("inProgressLegend")}
        </span>
      )}
    </div>
  )
}

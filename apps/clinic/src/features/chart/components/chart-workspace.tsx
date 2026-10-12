"use client"

import {
  CalendarClockIcon,
  CheckIcon,
  ClipboardPlusIcon,
  MousePointerClickIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
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
import { buildChartState, problemsOf, type ToothState } from "../state"
import { SURFACES, type ConditionInfo, type Dentition, type Surface } from "../teeth"
import { ToothChart, type ToothTap } from "./tooth-chart"

type OpenPlan = { id: string; title: string }

type Props = {
  patientId: string
  data: ChartData
  conditions: ConditionInfo[]
  catalog: Catalog
  openPlans: OpenPlan[]
  canEdit: boolean
  /** May add or change conditions in Settings (a link from the bar). */
  canManageConditions: boolean
  defaultDentition: Dentition
}

/** What a tap on a tooth does: show it, record a condition, or plan a treatment. */
type Tool = { kind: "view" } | { kind: "condition"; code: string } | { kind: "treatment" }

/** The small box next to a tooth: its details, or the surfaces for a planned treatment. */
type Opened = { tooth: number; anchor: HTMLElement; kind: "details" | "surfaces" }

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
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [, startTransition] = useTransition()
  const [dentition, setDentition] = useState<Dentition>(defaultDentition)
  const [tool, setTool] = useState<Tool>({ kind: "view" })
  const [opened, setOpened] = useState<Opened | null>(null)

  const [procedureId, setProcedureId] = useState("")
  const [planId, setPlanId] = useState<string>(openPlans[0]?.id ?? "new")
  const [newPlanTitle, setNewPlanTitle] = useState("")
  const [phase, setPhase] = useState("1")
  const [surfaces, setSurfaces] = useState<Set<Surface>>(new Set())

  const conditionMap = useMemo(() => new Map(conditions.map((c) => [c.code, c])), [conditions])
  const chart = useMemo(
    () => buildChartState(data.findings, data.items, conditionMap),
    [data, conditionMap],
  )
  const procedure = catalog.flatMap((c) => c.procedures).find((p) => p.id === procedureId)
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)

  const record = (condition: ConditionInfo, tooth: number, surface: Surface | null) =>
    startTransition(async () => {
      const result = await addFindingAction({
        patientId,
        teeth: [tooth],
        surfaces: condition.scope === "surfaces" && surface ? [surface] : [],
        condition: condition.code,
        notes: "",
      })
      if (!result.ok) return handleError(result)
      toast.success(t("recordedOn", { name: condition.name, tooth: String(tooth) }), {
        action: { label: t("undo"), onClick: () => undo(result.data.ids) },
      })
      router.refresh()
    })

  const undo = (ids: string[]) =>
    startTransition(async () => {
      for (const id of ids) {
        const result = await resolveFindingAction({ id })
        if (!result.ok) return handleError(result)
      }
      toast.success(t("undone"))
      router.refresh()
    })

  const resolve = (id: string) =>
    startTransition(async () => {
      const result = await resolveFindingAction({ id })
      if (!result.ok) return handleError(result)
      toast.success(t("resolved"))
      router.refresh()
    })

  const plan = (teeth: number[], picked: Surface[]) =>
    startTransition(async () => {
      if (!procedure) return
      let target = planId
      if (planId === "new") {
        const created = await createPlanAction({
          patientId,
          title: newPlanTitle || t("newPlanDefault"),
        })
        if (!created.ok) return handleError(created)
        target = created.data.id
        setPlanId(target)
      }
      const result = await addPlanItemsAction({
        planId: target,
        procedureId: procedure.id,
        teeth,
        surfaces: picked,
        phase: Number(phase),
        notes: "",
      })
      if (!result.ok) return handleError(result)
      toast.success(
        teeth.length
          ? t("plannedOn", { name: procedure.name, tooth: String(teeth[0]) })
          : t("itemsAdded", { count: result.data.count }),
      )
      setOpened(null)
      router.refresh()
    })

  const onTap = ({ tooth, surface, anchor }: ToothTap) => {
    if (!canEdit || tool.kind === "view") return setOpened({ tooth, anchor, kind: "details" })
    if (tool.kind === "condition") {
      const condition = conditionMap.get(tool.code)
      if (condition) record(condition, tooth, surface)
      return
    }
    if (!procedure) return toast.error(t("pickProcedureFirst"))
    if (procedure.toothScope !== "surfaces") return plan([tooth], [])
    // A filling goes where the tooth's problems are, unless a surface was tapped.
    const problemSurfaces = problemsOf(chart.get(tooth), conditionMap).flatMap((m) => m.surfaces)
    setSurfaces(new Set(surface ? [surface] : problemSurfaces))
    setOpened({ tooth, anchor, kind: "surfaces" })
  }

  const offered = conditions.filter((c) => !c.hidden)
  const chip = (key: string, active: boolean, onClick: () => void, children: ReactNode) => (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-tool={key}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-accent ring-primary text-foreground ring-1"
          : "bg-card text-foreground border-slate-200 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  )
  const conditionChip = (c: ConditionInfo) =>
    chip(
      c.code,
      tool.kind === "condition" && tool.code === c.code,
      () => setTool({ kind: "condition", code: c.code }),
      <>
        <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
        {c.name}
      </>,
    )

  const active = tool.kind === "condition" ? conditionMap.get(tool.code) : undefined
  const hint =
    tool.kind === "view"
      ? t("hintView")
      : active
        ? t(active.scope === "surfaces" ? "hintSurfaces" : "hintTooth", { name: active.name })
        : t("hintTreatment")

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="space-y-2" data-testid="chart-tools">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="toolbar" aria-label={t("tools")}>
            {chip(
              "view",
              tool.kind === "view",
              () => setTool({ kind: "view" }),
              <>
                <MousePointerClickIcon className="size-4" />
                {t("toolView")}
              </>,
            )}
            <span className="w-px shrink-0 bg-slate-200" />
            {offered.filter((c) => c.kind === "problem").map(conditionChip)}
            <span className="w-px shrink-0 bg-slate-200" />
            {offered.filter((c) => c.kind === "existing").map(conditionChip)}
            <span className="w-px shrink-0 bg-slate-200" />
            {chip(
              "treatment",
              tool.kind === "treatment",
              () => setTool({ kind: "treatment" }),
              <>
                <ClipboardPlusIcon className="size-4" />
                {t("toolTreatment")}
              </>,
            )}
          </div>

          {tool.kind === "treatment" && (
            <TreatmentBar
              catalog={catalog}
              openPlans={openPlans}
              procedureId={procedureId}
              setProcedureId={setProcedureId}
              planId={planId}
              setPlanId={setPlanId}
              newPlanTitle={newPlanTitle}
              setNewPlanTitle={setNewPlanTitle}
              phase={phase}
              setPhase={setPhase}
              onAddWholeMouth={() => plan([], [])}
              wholeMouth={procedure?.toothScope === "none"}
            />
          )}

          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
            {hint}
            {canManageConditions && (
              <Link
                href={"/settings/conditions" as Route}
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                <SettingsIcon className="size-3.5" />
                {t("manageConditions")}
              </Link>
            )}
          </p>
        </div>
      )}

      <div className="bg-muted/40 rounded-2xl border p-2">
        <div className="flex items-center gap-4 px-2 pt-1">
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
        <ToothChart
          dentition={dentition}
          chart={chart}
          conditions={conditionMap}
          activeTooth={opened?.tooth ?? null}
          onTap={onTap}
        />
      </div>

      <ChartFooter chart={chart} conditions={conditionMap} />

      <Popover open={!!opened} onOpenChange={(open) => !open && setOpened(null)}>
        {opened && <PopoverAnchor virtualRef={{ current: opened.anchor }} />}
        <PopoverContent className="w-72" data-testid="tooth-popover">
          {opened?.kind === "details" && (
            <ToothDetails
              tooth={opened.tooth}
              state={chart.get(opened.tooth)}
              conditions={conditionMap}
              canEdit={canEdit}
              onResolve={resolve}
            />
          )}
          {opened?.kind === "surfaces" && procedure && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">
                {t("surfacesFor", { name: procedure.name, tooth: String(opened.tooth) })}
              </p>
              <div className="flex gap-1.5" dir="ltr" role="group" aria-label={t("surfacesTitle")}>
                {SURFACES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={surfaces.has(s) ? "default" : "outline"}
                    aria-pressed={surfaces.has(s)}
                    aria-label={surfaceName(s)}
                    data-surface-chip={s}
                    className="w-10 font-mono"
                    onClick={() => {
                      const next = new Set(surfaces)
                      if (next.has(s)) next.delete(s)
                      else next.add(s)
                      setSurfaces(next)
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {surfaces.size ? [...surfaces].map(surfaceName).join("، ") : t("noSurfaces")}
              </p>
              <Button
                className="w-full"
                disabled={surfaces.size === 0}
                onClick={() => plan([opened.tooth], [...surfaces])}
              >
                {t("addItems")}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function TreatmentBar(props: {
  catalog: Catalog
  openPlans: OpenPlan[]
  procedureId: string
  setProcedureId: (v: string) => void
  planId: string
  setPlanId: (v: string) => void
  newPlanTitle: string
  setNewPlanTitle: (v: string) => void
  phase: string
  setPhase: (v: string) => void
  wholeMouth: boolean
  onAddWholeMouth: () => void
}) {
  const t = useTranslations("chart")
  if (props.catalog.every((c) => c.procedures.length === 0)) {
    return <p className="text-muted-foreground text-sm">{t("catalogEmpty")}</p>
  }
  return (
    <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3">
      <Field className="min-w-56 flex-1">
        <FieldLabel htmlFor="procedure">{t("procedure")}</FieldLabel>
        <Select value={props.procedureId} onValueChange={props.setProcedureId}>
          <SelectTrigger id="procedure">
            <SelectValue placeholder={t("procedurePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {props.catalog
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
      </Field>
      <Field className="min-w-44">
        <FieldLabel htmlFor="plan">{t("plan")}</FieldLabel>
        <Select value={props.planId} onValueChange={props.setPlanId}>
          <SelectTrigger id="plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.openPlans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
            <SelectItem value="new">{t("newPlan")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {props.planId === "new" && (
        <Field className="min-w-44">
          <FieldLabel htmlFor="newPlanTitle">{t("newPlanTitle")}</FieldLabel>
          <Input
            id="newPlanTitle"
            value={props.newPlanTitle}
            placeholder={t("newPlanDefault")}
            maxLength={100}
            onChange={(e) => props.setNewPlanTitle(e.target.value)}
          />
        </Field>
      )}
      <Field className="w-24">
        <FieldLabel htmlFor="phase">
          {t("phase")} <InfoHint>{t("phaseHint")}</InfoHint>
        </FieldLabel>
        <Select value={props.phase} onValueChange={props.setPhase}>
          <SelectTrigger id="phase">
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
      {props.wholeMouth && <Button onClick={props.onAddWholeMouth}>{t("addItems")}</Button>}
    </div>
  )
}

/** Tapping a tooth with nothing chosen: what's on it and what's planned. */
function ToothDetails({
  tooth,
  state,
  conditions,
  canEdit,
  onResolve,
}: {
  tooth: number
  state: ToothState | undefined
  conditions: ReadonlyMap<string, ConditionInfo>
  canEdit: boolean
  onResolve: (id: string) => void
}) {
  const t = useTranslations("chart")
  const surfaceName = (s: Surface) => t(`surfaces.${s}`)
  const marks = state?.marks ?? []
  const planned = state?.planned ?? []
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{t("toothLabel", { tooth: String(tooth) })}</p>
      {marks.length + planned.length === 0 && (
        <p className="text-muted-foreground">{t("healthy")}</p>
      )}
      <ul className="space-y-1">
        {marks.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: conditions.get(m.condition)?.color }}
              />
              <span>
                {conditions.get(m.condition)?.name}
                {m.surfaces.length > 0 && (
                  <span className="text-muted-foreground ms-1 text-xs">
                    {m.surfaces.map(surfaceName).join("، ")}
                  </span>
                )}
                {m.source === "treatment" && (
                  <span className="text-muted-foreground ms-1 text-xs">{t("fromTreatment")}</span>
                )}
              </span>
            </span>
            {canEdit && m.source === "finding" && (
              <IconButton label={t("resolve")} onClick={() => onResolve(m.id)}>
                <CheckIcon />
              </IconButton>
            )}
          </li>
        ))}
        {planned.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <CalendarClockIcon className="size-3.5 shrink-0" />
            {t("plannedOnTooth")}: {p.procedureName}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One line under the chart: what needs treatment, and what the colours mean. */
function ChartFooter({
  chart,
  conditions,
}: {
  chart: Map<number, ToothState>
  conditions: ReadonlyMap<string, ConditionInfo>
}) {
  const t = useTranslations("chart")
  const teeth = [...chart.keys()].sort((a, b) => a - b)
  const problems = teeth.flatMap((tooth) =>
    problemsOf(chart.get(tooth), conditions).map((m) => ({ tooth, m })),
  )
  const present = new Set([...chart.values()].flatMap((s) => s.marks.map((m) => m.condition)))
  const shown = [...conditions.values()].filter((c) => present.has(c.code))
  const anyPlanned = [...chart.values()].some((s) => s.planned.length > 0)
  if (problems.length === 0 && shown.length === 0 && !anyPlanned) return null
  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border px-3 py-2 text-xs">
      {problems.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5" data-testid="needs-treatment">
          <TriangleAlertIcon className="size-3.5 text-red-600" />
          <span className="text-foreground font-semibold">{t("needsTreatment")}:</span>
          {problems.map(({ tooth, m }) => (
            <span key={m.id} className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-800">
              <bdi>{tooth}</bdi> {conditions.get(m.condition)?.name}
            </span>
          ))}
        </p>
      )}
      <p
        className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1"
        aria-label={t("legend")}
      >
        {shown.map((c) => (
          <span key={c.code} className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: c.color }} />
            {c.name}
          </span>
        ))}
        {anyPlanned && (
          <span className="flex items-center gap-1">
            <span className="flex size-3.5 items-center justify-center rounded-full bg-blue-600 text-white">
              <CalendarClockIcon className="size-2.5" />
            </span>
            {t("plannedLegend")}
          </span>
        )}
      </p>
    </div>
  )
}

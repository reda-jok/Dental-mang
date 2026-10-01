"use client"

import { CheckIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useActionErrorHandler } from "@/lib/form"
import { formatMoney } from "@/lib/money"

import type { Catalog } from "../../procedures/data"
import { addPlanItemsAction, createPlanAction } from "../../plans/actions"
import { addFindingAction, resolveFindingAction } from "../actions"
import type { ChartData } from "../data"
import { buildChartState } from "../state"
import { conditionInfo, SURFACES, TOOTH_CONDITIONS, type Surface } from "../teeth"
import { LEGEND_DOTS, ToothChart, type Dentition } from "./tooth-chart"

type OpenPlan = { id: string; title: string }

type Props = {
  patientId: string
  data: ChartData
  catalog: Catalog
  openPlans: OpenPlan[]
  canEdit: boolean
  defaultDentition: Dentition
}

export function ChartWorkspace({
  patientId,
  data,
  catalog,
  openPlans,
  canEdit,
  defaultDentition,
}: Props) {
  const t = useTranslations("chart")
  const tc = useTranslations("common")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const [dentition, setDentition] = useState<Dentition>(defaultDentition)
  const [teeth, setTeeth] = useState<Set<number>>(new Set())
  const [surfaces, setSurfaces] = useState<Set<Surface>>(new Set())

  const [condition, setCondition] = useState<string>("caries")
  const [findingNotes, setFindingNotes] = useState("")

  const [planId, setPlanId] = useState<string>(openPlans[0]?.id ?? "new")
  const [newPlanTitle, setNewPlanTitle] = useState("")
  const [procedureId, setProcedureId] = useState<string>("")
  const [phase, setPhase] = useState("1")

  const chart = useMemo(() => buildChartState(data.findings, data.items), [data])
  const procedures = useMemo(() => catalog.flatMap((c) => c.procedures), [catalog])
  const procedure = procedures.find((p) => p.id === procedureId)

  const toggleTooth = (tooth: number) =>
    setTeeth((prev) => {
      const next = new Set(prev)
      if (next.has(tooth)) next.delete(tooth)
      else next.add(tooth)
      return next
    })

  const toggleSurface = (surface: Surface) =>
    setSurfaces((prev) => {
      const next = new Set(prev)
      if (next.has(surface)) next.delete(surface)
      else next.add(surface)
      return next
    })

  const clear = () => {
    setTeeth(new Set())
    setSurfaces(new Set())
  }

  const selectedTeeth = [...teeth].sort((a, b) => a - b)
  const single = selectedTeeth.length === 1 ? chart.get(selectedTeeth[0]!) : undefined

  const saveFinding = () =>
    startTransition(async () => {
      const result = await addFindingAction({
        patientId,
        teeth: selectedTeeth,
        surfaces: conditionInfo(condition)?.scope === "surfaces" ? [...surfaces] : [],
        condition: condition as never,
        notes: findingNotes,
      })
      if (!result.ok) return handleError(result)
      toast.success(t("findingSaved"))
      setFindingNotes("")
      clear()
      router.refresh()
    })

  const resolve = (id: string) =>
    startTransition(async () => {
      const result = await resolveFindingAction({ id })
      if (!result.ok) return handleError(result)
      toast.success(t("resolved"))
      router.refresh()
    })

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
        teeth: procedure?.toothScope === "none" ? [] : selectedTeeth,
        surfaces: procedure?.toothScope === "surfaces" ? [...surfaces] : [],
        phase: Number(phase),
        notes: "",
      })
      if (!result.ok) return handleError(result)
      toast.success(t("itemsAdded", { count: result.data.count }))
      clear()
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

  return (
    // min-w-0: lets the wide chart scroll inside its column instead of widening the page.
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
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
            selectedTeeth={teeth}
            onToggleTooth={toggleTooth}
            disabled={!canEdit}
          />
        </div>

        <Legend />
      </div>

      <div className="grid min-w-0 content-start gap-4 lg:grid-cols-3 2xl:grid-cols-1">
        <Card className="overflow-hidden rounded-2xl pt-0">
          {/* Dark "Tooth Details" header, as in the clinic's original chart */}
          <CardHeader className="flex-row items-center justify-between space-y-0 bg-slate-900 py-4 text-white">
            <CardTitle className="text-base">{t("toothDetails")}</CardTitle>
            <div className="flex items-center gap-2">
              {selectedTeeth.length === 1 && (
                <Badge className="bg-blue-500 px-3 text-base hover:bg-blue-600" dir="ltr">
                  #{selectedTeeth[0]}
                </Badge>
              )}
              {selectedTeeth.length > 0 && (
                <IconButton
                  label={t("clearSelection")}
                  onClick={clear}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <XIcon />
                </IconButton>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedTeeth.length === 0 ? (
              <p className="text-muted-foreground">
                {canEdit ? t("noneSelected") : t("noPlanPermission")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1" dir="ltr">
                  {selectedTeeth.map((tooth) => (
                    <Badge key={tooth} variant="secondary">
                      {tooth}
                    </Badge>
                  ))}
                </div>
                {canEdit && (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground flex items-center gap-1 text-xs font-semibold">
                      {t("surfacesSelected")} <InfoHint>{t("surfacesPickHint")}</InfoHint>
                    </p>
                    <div
                      className="flex gap-1.5"
                      dir="ltr"
                      role="group"
                      aria-label={t("surfacesSelected")}
                    >
                      {SURFACES.map((s) => (
                        <Tooltip key={s}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant={surfaces.has(s) ? "default" : "outline"}
                              aria-pressed={surfaces.has(s)}
                              aria-label={t(`surfaces.${s}`)}
                              data-surface-chip={s}
                              className="w-9 font-mono"
                              onClick={() => toggleSurface(s)}
                            >
                              {s}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t(`surfaces.${s}`)}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <p className="text-xs">
                      {surfaces.size
                        ? [...surfaces].map((s) => t(`surfaces.${s}`)).join("، ")
                        : t("wholeTooth")}
                    </p>
                  </div>
                )}
              </>
            )}

            {single && (single.marks.length > 0 || single.planned.length > 0) && (
              <ul className="space-y-1 border-t pt-3">
                {single.marks.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-3 rounded-full ${LEGEND_DOTS[m.condition] ?? "bg-slate-300"}`}
                      />
                      {t(`conditions.${m.condition as "caries"}`)}
                      {m.surfaces.length > 0 && <span dir="ltr">({m.surfaces.join("")})</span>}
                      {m.source === "treatment" && (
                        <span className="text-muted-foreground">{t("fromTreatment")}</span>
                      )}
                    </span>
                    {canEdit && m.source === "finding" && (
                      <IconButton
                        label={t("resolve")}
                        onClick={() => resolve(m.id)}
                        pending={pending}
                      >
                        <CheckIcon />
                      </IconButton>
                    )}
                  </li>
                ))}
                {single.planned.map((p) => (
                  <li key={p.id} className="text-blue-700 dark:text-blue-400">
                    {t("plannedOnTooth")}: {p.procedureName}
                    {p.surfaces.length > 0 && <span dir="ltr"> ({p.surfaces.join("")})</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canEdit && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("recordFinding")} <InfoHint>{t("recordFindingHint")}</InfoHint>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="condition">{t("condition")}</FieldLabel>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger id="condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOOTH_CONDITIONS.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="size-3 rounded-sm" style={{ background: c.color }} />
                            {t(`conditions.${c.code}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="findingNotes">
                      {t("findingNotes")}{" "}
                      <span className="text-muted-foreground font-normal">({tc("optional")})</span>
                    </FieldLabel>
                    <Input
                      id="findingNotes"
                      value={findingNotes}
                      maxLength={300}
                      onChange={(e) => setFindingNotes(e.target.value)}
                    />
                  </Field>
                  <Button onClick={saveFinding} disabled={pending || selectedTeeth.length === 0}>
                    {t("saveFinding")}
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("addToPlan")}</CardTitle>
              </CardHeader>
              <CardContent>
                {procedures.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("catalogEmpty")}</p>
                ) : (
                  <FieldGroup className="gap-3">
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
                                    <span
                                      className="text-muted-foreground ms-auto text-xs"
                                      dir="ltr"
                                    >
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
                    <Field>
                      <FieldLabel htmlFor="phase">
                        {t("phase")} <InfoHint>{t("phaseHint")}</InfoHint>
                      </FieldLabel>
                      <Select value={phase} onValueChange={setPhase}>
                        <SelectTrigger id="phase" className="w-24">
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
                    <Button
                      onClick={addToPlan}
                      disabled={
                        pending ||
                        !procedure ||
                        (procedure.toothScope !== "none" && selectedTeeth.length === 0)
                      }
                    >
                      {t("addItems")}
                    </Button>
                  </FieldGroup>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Legend() {
  const t = useTranslations("chart")
  return (
    <div
      className="text-muted-foreground flex flex-wrap justify-center gap-4 rounded-lg border bg-white p-3 text-xs font-medium shadow-sm dark:bg-transparent"
      aria-label={t("legend")}
    >
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full border border-slate-300 bg-white" />
        {t("healthy")}
      </span>
      {TOOTH_CONDITIONS.map((c) => (
        <span key={c.code} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-full ${LEGEND_DOTS[c.code]}`} />
          {t(`conditions.${c.code}`)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-blue-600" />
        {t("plannedLegend")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-amber-500" />
        {t("inProgressLegend")}
      </span>
    </div>
  )
}

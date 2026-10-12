"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { TextField } from "@/components/form-field"
import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"
import { cn } from "@/lib/utils"

import { createConditionAction, setConditionHiddenAction, updateConditionAction } from "../actions"
import type { ConditionRow } from "../data"
import {
  createConditionSchema,
  updateConditionSchema,
  type CreateConditionInput,
  type UpdateConditionInput,
} from "../schemas"
import { CONDITION_COLORS } from "../teeth"

/** Settings → Tooth conditions: what the chart can record. */
export function ConditionsManager({
  conditions,
  canEdit,
}: {
  conditions: ConditionRow[]
  canEdit: boolean
}) {
  const t = useTranslations("toothConditions")
  const handleError = useActionErrorHandler()
  const [editing, setEditing] = useState<ConditionRow | "new" | null>(null)
  const [pending, startTransition] = useTransition()

  const setHidden = (c: ConditionRow, hidden: boolean) =>
    startTransition(async () => {
      const result = await setConditionHiddenAction({ code: c.code, hidden })
      if (!result.ok) return handleError(result)
      toast.success(t(hidden ? "hidden" : "shown"))
    })

  return (
    <div className="space-y-4">
      {canEdit && (
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("add")}
        </Button>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t("name")}</TableHead>
              <TableHead>{t("kind")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("scope")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.map((c) => (
              <TableRow
                key={c.code}
                data-condition-row={c.label}
                className={c.hiddenAt ? "opacity-50" : ""}
              >
                <TableCell className="ps-4">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="size-4 shrink-0 rounded-full"
                      style={{ background: c.color }}
                    />
                    {c.label}
                    {c.hiddenAt && <Badge variant="secondary">{t("hiddenBadge")}</Badge>}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={c.kind === "problem" ? "border-red-200 text-red-700" : ""}
                  >
                    {t(`kinds.${c.kind}`)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-slate-600 sm:table-cell">
                  {t(`scopes.${c.scope}`)}
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <span className="flex justify-end gap-1">
                      <IconButton
                        label={t("editLabel", { name: c.label })}
                        onClick={() => setEditing(c)}
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton
                        label={t(c.hiddenAt ? "showLabel" : "hideLabel", { name: c.label })}
                        pending={pending}
                        onClick={() => setHidden(c, !c.hiddenAt)}
                      >
                        {c.hiddenAt ? <EyeIcon /> : <EyeOffIcon />}
                      </IconButton>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? t("addTitle") : t("editTitle")}</DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
          </DialogHeader>
          {editing === "new" && <CreateForm onDone={() => setEditing(null)} />}
          {editing && editing !== "new" && (
            <EditForm condition={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (color: (typeof CONDITION_COLORS)[number]) => void
  error?: string
}) {
  const t = useTranslations("toothConditions")
  return (
    <Field>
      <FieldLabel>{t("color")}</FieldLabel>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("color")}>
        {CONDITION_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={t(`colors.${color.slice(1) as "dc2626"}`)}
            onClick={() => onChange(color)}
            className={cn(
              "focus-visible:ring-ring size-8 rounded-full ring-offset-2 transition focus-visible:ring-2 focus-visible:outline-none",
              value === color && "ring-foreground ring-2",
            )}
            style={{ background: color }}
          />
        ))}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("toothConditions")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<CreateConditionInput, unknown, z.output<typeof createConditionSchema>>({
    resolver: zodResolver(createConditionSchema),
    mode: "onTouched",
    defaultValues: { name: "", color: CONDITION_COLORS[11], scope: "surfaces", kind: "problem" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createConditionAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("created"))
        onDone()
      }),
    onInvalid,
  )

  const radios = <K extends "kind" | "scope">(
    name: K,
    values: readonly CreateConditionInput[K][],
    hint?: string,
  ) => (
    <Field>
      <FieldLabel>
        {t(name as "kind")}
        {hint && <InfoHint>{hint}</InfoHint>}
      </FieldLabel>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
            {values.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`${name}-${v}`} />
                <Label htmlFor={`${name}-${v}`} className="font-normal">
                  {name === "kind" ? t(`kinds.${v as "problem"}`) : t(`scopes.${v as "tooth"}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      />
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="conditionName"
          label={t("name")}
          placeholder={t("namePlaceholder")}
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
        />
        {radios("kind", ["problem", "existing"], t("kindHint"))}
        {radios("scope", ["surfaces", "tooth"])}
        <FieldDescription>{t("fixedAfterCreate")}</FieldDescription>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

function EditForm({ condition, onDone }: { condition: ConditionRow; onDone: () => void }) {
  const t = useTranslations("toothConditions")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<UpdateConditionInput, unknown, z.output<typeof updateConditionSchema>>({
    resolver: zodResolver(updateConditionSchema),
    mode: "onTouched",
    defaultValues: {
      code: condition.code,
      name: condition.name ?? "",
      color: condition.color as UpdateConditionInput["color"],
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await updateConditionAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("updated"))
        onDone()
      }),
    onInvalid,
  )

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <TextField
          id="conditionName"
          label={t("name")}
          optional={condition.builtIn}
          placeholder={condition.builtIn ? condition.label : t("namePlaceholder")}
          description={
            condition.builtIn ? t("builtInNameHint", { name: condition.label }) : undefined
          }
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
        />
        <p className="text-muted-foreground text-sm">
          {t(`kinds.${condition.kind}`)} · {t(`scopes.${condition.scope}`)}
        </p>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

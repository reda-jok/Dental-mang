"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"

import { saveMedicalHistoryAction } from "../actions"
import type { MedicalHistoryView } from "../data"
import { medicalHistorySchema, type MedicalHistoryInput } from "../schemas"
import { EMPTY_MEDICAL, MedicalQuestionnaire } from "./medical-questionnaire"

type Props = {
  patientId: string
  gender: "male" | "female"
  history: MedicalHistoryView | null
  canEdit: boolean
}

export function MedicalHistoryForm({ patientId, gender, history, canEdit }: Props) {
  const t = useTranslations("medical")
  const tc = useTranslations("common")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const form = useForm<MedicalHistoryInput>({
    resolver: zodResolver(medicalHistorySchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      ...(EMPTY_MEDICAL as MedicalHistoryInput),
      ...(history && {
        noneDeclared: history.noneDeclared,
        conditions: history.conditions as MedicalHistoryInput["conditions"],
        otherConditions: history.otherConditions ?? "",
        allergies: history.allergies as MedicalHistoryInput["allergies"],
        otherAllergies: history.otherAllergies ?? "",
        medications: history.medications ?? "",
        pregnant: history.pregnant,
        smoker: history.smoker,
        notes: history.notes ?? "",
      }),
      patientId,
      baseVersion: history?.version ?? 0,
    },
  })
  const { isDirty } = form.formState

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await saveMedicalHistoryAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("saved"))
        router.refresh()
      }),
    onInvalid,
  )

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
        <fieldset disabled={!canEdit || pending}>
          <MedicalQuestionnaire gender={gender} />
        </fieldset>
        {canEdit && (
          <Button type="submit" disabled={!isDirty || pending}>
            {pending ? tc("saving") : t("save")}
          </Button>
        )}
      </form>
    </FormProvider>
  )
}

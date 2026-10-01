import { useTranslations } from "next-intl"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ageInYears } from "@/lib/dates"

/** "35 سنة", or "~35 سنة" with an explanation when the age was only estimated. */
export function PatientAge({
  birthDate,
  estimated,
  today,
}: {
  birthDate: string | null
  estimated: boolean
  today: string
}) {
  const t = useTranslations("patients")
  if (!birthDate) return <span className="text-muted-foreground">{t("notSet")}</span>
  const age = ageInYears(birthDate, today)
  if (!estimated) return <span>{t("ageYears", { age: String(age) })}</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
          {t("ageApprox", { age: String(age) })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("ageApproxHint")}</TooltipContent>
    </Tooltip>
  )
}

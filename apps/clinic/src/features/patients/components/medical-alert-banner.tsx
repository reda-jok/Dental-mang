import { AlertCircleIcon, ClipboardXIcon } from "lucide-react"
import type { Route } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import type { MedicalHistoryView } from "../data"
import { medicalAlerts } from "../medical"

/**
 * Safety banner at the top of every patient page, for staff who treat patients.
 * Styled like the clinic's original "Medical Alerts" bar (red edge on the start side).
 */
export async function MedicalAlertBanner({
  patientId,
  history,
}: {
  patientId: string
  history: MedicalHistoryView | null
}) {
  const t = await getTranslations("medical")

  if (!history) {
    return (
      <div className="flex items-start gap-3 rounded-e-lg border-s-4 border-amber-500 bg-amber-50 p-4 shadow-sm">
        <ClipboardXIcon className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <p className="text-sm text-amber-800">
          {t("alertNoHistory")}{" "}
          <Link
            href={`/patients/${patientId}/medical` as Route}
            className="font-medium underline underline-offset-4"
          >
            {t("noneAction")}
          </Link>
        </p>
      </div>
    )
  }

  const alerts = medicalAlerts(history)
  if (!alerts) return null

  const items = [
    ...alerts.allergies.map(
      (code) => `${t("allergiesLabel")}: ${t(`allergies.${code as "latex"}`)}`,
    ),
    ...(alerts.otherAllergies ? [t("alertOtherAllergy", { text: alerts.otherAllergies })] : []),
    ...alerts.conditions.map((code) => t(`conditions.${code as "diabetes"}`)),
    ...(alerts.pregnant ? [t("alertPregnant")] : []),
  ]

  return (
    <div
      role="alert"
      data-testid="medical-alert"
      className="flex items-start gap-3 rounded-e-lg border-s-4 border-red-500 bg-red-50 p-4 shadow-sm"
    >
      <AlertCircleIcon className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
      <div>
        <h3 className="text-sm font-semibold text-red-800">{t("alertTitle")}</h3>
        <ul className="mt-1 flex flex-wrap gap-x-2 text-sm text-red-700">
          {items.map((item, i) => (
            <li key={item}>
              {i > 0 && <span className="me-2 text-red-300">|</span>}
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

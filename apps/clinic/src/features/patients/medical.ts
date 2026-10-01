// Medical-history checklist items that matter in dentistry. Stored as codes;
// labels live in messages/ar.json under "medical.conditions" / "medical.allergies".
// `alert: true` puts the item in the red banner on the patient's page.

export const MEDICAL_CONDITIONS = [
  { code: "anticoagulants", alert: true }, // bleeding risk (warfarin, aspirin, clopidogrel…)
  { code: "bleeding_disorder", alert: true },
  { code: "heart_disease", alert: true },
  { code: "pacemaker", alert: true },
  { code: "endocarditis_risk", alert: true }, // may need antibiotic prophylaxis
  { code: "hypertension", alert: true },
  { code: "diabetes", alert: true },
  { code: "asthma", alert: false },
  { code: "epilepsy", alert: true },
  { code: "kidney_disease", alert: true },
  { code: "liver_disease", alert: true },
  { code: "hepatitis", alert: true }, // infection control
  { code: "hiv", alert: true },
  { code: "thyroid", alert: false },
  { code: "bisphosphonates", alert: true }, // osteonecrosis risk after extraction
  { code: "radiotherapy_head_neck", alert: true },
  { code: "cancer_treatment", alert: true },
] as const

export const ALLERGIES = [
  { code: "penicillin", alert: true },
  { code: "local_anesthetic", alert: true },
  { code: "latex", alert: true },
  { code: "nsaids", alert: true }, // ibuprofen, aspirin…
  { code: "chlorhexidine", alert: true },
] as const

export type ConditionCode = (typeof MEDICAL_CONDITIONS)[number]["code"]
export type AllergyCode = (typeof ALLERGIES)[number]["code"]

export const CONDITION_CODES = MEDICAL_CONDITIONS.map((c) => c.code) as [
  ConditionCode,
  ...ConditionCode[],
]
export const ALLERGY_CODES = ALLERGIES.map((a) => a.code) as [AllergyCode, ...AllergyCode[]]

type HistoryForAlerts = {
  conditions: string[]
  allergies: string[]
  otherAllergies: string | null
  pregnant: boolean
}

export type MedicalAlerts = {
  allergies: string[] // codes
  otherAllergies: string | null
  conditions: string[] // codes
  pregnant: boolean
}

/** What the red banner shows. Null when there is nothing to warn about. */
export function medicalAlerts(history: HistoryForAlerts | null): MedicalAlerts | null {
  if (!history) return null
  const alerting = (list: readonly { code: string; alert: boolean }[], codes: string[]) =>
    list.filter((item) => item.alert && codes.includes(item.code)).map((item) => item.code)

  const alerts: MedicalAlerts = {
    allergies: alerting(ALLERGIES, history.allergies),
    otherAllergies: history.otherAllergies,
    conditions: alerting(MEDICAL_CONDITIONS, history.conditions),
    pregnant: history.pregnant,
  }
  const any =
    alerts.allergies.length > 0 ||
    !!alerts.otherAllergies ||
    alerts.conditions.length > 0 ||
    alerts.pregnant
  return any ? alerts : null
}

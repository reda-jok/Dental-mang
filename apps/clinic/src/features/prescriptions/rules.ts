// Prescribing warnings from the patient's latest medical history: pure, unit-tested,
// shown live in the form and checked again by the server. Allergy conflicts are
// "danger" (the dentist must confirm); other flags are "caution".

/** Conditions on record that call for care with anti-inflammatory painkillers (NSAIDs). */
export const NSAID_CAUTIONS = [
  "anticoagulants",
  "bleeding_disorder",
  "kidney_disease",
  "asthma",
] as const

export type PrescriptionWarning =
  | { kind: "allergy"; level: "danger"; code: string; medication: string }
  | { kind: "condition"; level: "caution"; code: string; medication: string }
  | { kind: "pregnancy"; level: "caution" }
  | { kind: "noHistory"; level: "caution" }

type History = { allergies: string[]; conditions: string[]; pregnant: boolean }

export function prescriptionWarnings(
  history: History | null,
  medications: readonly { name: string; group: string | null }[],
): PrescriptionWarning[] {
  if (medications.length === 0) return []
  if (!history) return [{ kind: "noHistory", level: "caution" }]
  const warnings: PrescriptionWarning[] = []
  for (const m of medications) {
    if (m.group && history.allergies.includes(m.group)) {
      warnings.push({ kind: "allergy", level: "danger", code: m.group, medication: m.name })
    }
    if (m.group === "nsaids") {
      for (const code of NSAID_CAUTIONS) {
        if (history.conditions.includes(code)) {
          warnings.push({ kind: "condition", level: "caution", code, medication: m.name })
        }
      }
    }
  }
  if (history.pregnant) warnings.push({ kind: "pregnancy", level: "caution" })
  return warnings
}

/** The allergy codes the dentist has to confirm before the prescription is saved. */
export function needsConfirmation(warnings: readonly PrescriptionWarning[]): string[] {
  return [...new Set(warnings.flatMap((w) => (w.kind === "allergy" ? [w.code] : [])))]
}

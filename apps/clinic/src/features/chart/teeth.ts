// Dental domain basics: FDI tooth numbering, surfaces, and the conditions a chart shows.
// Pure and shared by client and server.

/** Upper then lower row, each in the order the dentist sees them (patient's right first). */
export const PERMANENT_ROWS = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
] as const

export const PRIMARY_ROWS = [
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
] as const

export const ALL_TEETH: readonly number[] = [...PERMANENT_ROWS.flat(), ...PRIMARY_ROWS.flat()]

export function isValidTooth(tooth: number): boolean {
  const quadrant = Math.floor(tooth / 10)
  const position = tooth % 10
  if (quadrant >= 1 && quadrant <= 4) return position >= 1 && position <= 8
  if (quadrant >= 5 && quadrant <= 8) return position >= 1 && position <= 5
  return false
}

export function isPrimary(tooth: number): boolean {
  return Math.floor(tooth / 10) >= 5
}

export function isUpper(tooth: number): boolean {
  return [1, 2, 5, 6].includes(Math.floor(tooth / 10))
}

/** Incisors and canines (positions 1–3) have an incisal edge instead of an occlusal surface. */
export function isAnterior(tooth: number): boolean {
  return tooth % 10 <= 3
}

/**
 * Surface codes: M mesial, D distal, O occlusal (incisal on front teeth),
 * B buccal (labial on front teeth), L lingual (palatal on upper teeth).
 */
export const SURFACES = ["M", "D", "O", "B", "L"] as const
export type Surface = (typeof SURFACES)[number]

/** Sort surfaces into a stable order and drop duplicates: "OMM" → ["M", "O"]. */
export function normalizeSurfaces(surfaces: readonly string[]): Surface[] {
  const set = new Set(surfaces)
  return SURFACES.filter((s) => set.has(s))
}

/** Is the mesial side on the viewer's right? (Teeth left of the midline on the chart.) */
export function mesialOnRight(tooth: number): boolean {
  return [1, 4, 5, 8].includes(Math.floor(tooth / 10))
}

/**
 * Conditions the chart shows. `scope: "surfaces"` conditions can be on specific
 * surfaces; "tooth" conditions apply to the whole tooth.
 */
export const TOOTH_CONDITIONS = [
  { code: "caries", scope: "surfaces", color: "#dc2626" },
  { code: "filling", scope: "surfaces", color: "#2563eb" },
  { code: "fracture", scope: "surfaces", color: "#ea580c" },
  { code: "crown", scope: "tooth", color: "#ca8a04" },
  { code: "root_canal", scope: "tooth", color: "#7c3aed" },
  { code: "missing", scope: "tooth", color: "#6b7280" },
  { code: "implant", scope: "tooth", color: "#0d9488" },
  { code: "bridge", scope: "tooth", color: "#a16207" },
  { code: "veneer", scope: "tooth", color: "#db2777" },
  { code: "impacted", scope: "tooth", color: "#4b5563" },
  { code: "root_remnant", scope: "tooth", color: "#b91c1c" },
] as const

export type ToothCondition = (typeof TOOTH_CONDITIONS)[number]["code"]
export const CONDITION_CODES = TOOTH_CONDITIONS.map((c) => c.code) as [
  ToothCondition,
  ...ToothCondition[],
]

export function conditionInfo(code: string) {
  return TOOTH_CONDITIONS.find((c) => c.code === code)
}

/** Whole-tooth conditions that replace the tooth's normal drawing. */
export function isToothGone(condition: string) {
  return condition === "missing" || condition === "implant"
}

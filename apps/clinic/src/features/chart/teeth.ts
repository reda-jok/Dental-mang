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

export type Dentition = "permanent" | "mixed" | "primary"

/** Children: primary teeth under ~6, mixed until ~12. Unknown age = permanent. */
export function dentitionForAge(age: number | null): Dentition {
  return age === null || age >= 12 ? "permanent" : age < 6 ? "primary" : "mixed"
}

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
 * The built-in conditions. The migration puts them in `tooth_condition`, where the clinic
 * can rename, recolour or hide them and add its own. `scope: "surfaces"` conditions can be
 * on specific surfaces, "tooth" ones apply to the whole tooth. A "problem" needs treatment,
 * and a treatment done on the same surfaces (or the whole tooth) clears it from the chart.
 */
export const TOOTH_CONDITIONS = [
  { code: "caries", scope: "surfaces", kind: "problem", color: "#dc2626" },
  { code: "fracture", scope: "surfaces", kind: "problem", color: "#ea580c" },
  { code: "root_remnant", scope: "tooth", kind: "problem", color: "#b91c1c" },
  { code: "impacted", scope: "tooth", kind: "problem", color: "#4b5563" },
  { code: "filling", scope: "surfaces", kind: "existing", color: "#2563eb" },
  { code: "crown", scope: "tooth", kind: "existing", color: "#ca8a04" },
  { code: "root_canal", scope: "tooth", kind: "existing", color: "#7c3aed" },
  { code: "bridge", scope: "tooth", kind: "existing", color: "#a16207" },
  { code: "veneer", scope: "tooth", kind: "existing", color: "#db2777" },
  { code: "implant", scope: "tooth", kind: "existing", color: "#0d9488" },
  { code: "missing", scope: "tooth", kind: "existing", color: "#6b7280" },
] as const

export type BuiltInCondition = (typeof TOOTH_CONDITIONS)[number]["code"]

/** A condition as the chart uses it: from the database, with its name already resolved. */
export type ConditionInfo = {
  code: string
  name: string
  color: string
  scope: "surfaces" | "tooth"
  kind: "problem" | "existing"
  hidden: boolean
}

export type Conditions = ReadonlyMap<string, ConditionInfo>

/** The colours a condition can have (Settings → Tooth conditions). */
export const CONDITION_COLORS = [
  "#dc2626",
  "#b91c1c",
  "#ea580c",
  "#ca8a04",
  "#a16207",
  "#65a30d",
  "#16a34a",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#4b5563",
  "#6b7280",
] as const

/** A colour mixed with white (`amount` 0 = the colour, 1 = white): tile backgrounds. */
export function tint(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(n >> 16)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`
}

/** Whole-tooth conditions that replace the tooth's normal drawing. */
export function isToothGone(condition: string) {
  return condition === "missing" || condition === "implant"
}

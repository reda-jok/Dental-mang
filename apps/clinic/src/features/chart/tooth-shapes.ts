// Drawings of each kind of tooth for the chart: seen from the side (crown and roots) and
// from the biting side (its five surfaces). Coordinates are for an upper tooth in a
// 40 × 100 box, roots up and crown down; lower teeth are drawn flipped.

export type ToothKind = "incisor" | "canine" | "premolar" | "molar"

/** FDI position → kind. Primary 4–5 are molars. */
export function toothKind(tooth: number): ToothKind {
  const position = tooth % 10
  if (position <= 2) return "incisor"
  if (position === 3) return "canine"
  if (Math.floor(tooth / 10) >= 5 || position >= 6) return "molar"
  return "premolar"
}

type Shape = {
  crown: string
  root: string
  /** Root canal lines, one per root. */
  canals: string[]
  /** The biting surface seen from above, in a 40 × 30 box. */
  occlusal: { rx: number; ry: number; w: number; h: number }
}

export const CROWN_TOP = 58
/** Below this line (towards the biting edge) the crown shows the occlusal surface. */
export const OCCLUSAL_BAND = 84

export const SHAPES: Record<ToothKind, Shape> = {
  incisor: {
    crown:
      "M13 58 C10 66 9 78 10 89 C10.5 94 12.5 96 15.5 96 L24.5 96 C27.5 96 29.5 94 30 89 C31 78 30 66 27 58 Z",
    root: "M13 58 C12 42 15.5 20 18.5 9 C19.2 6.5 20.8 6.5 21.5 9 C24.5 20 28 42 27 58 Z",
    canals: ["M20 56 C20 40 20 24 20 12"],
    occlusal: { rx: 5.5, ry: 5.5, w: 22, h: 11 },
  },
  canine: {
    crown:
      "M12.5 58 C8.5 64 7.5 73 9 81 C10.5 88 15.5 93.5 20 97.5 C24.5 93.5 29.5 88 31 81 C32.5 73 31.5 64 27.5 58 Z",
    root: "M12.5 58 C11.5 38 15 13 18.8 3.5 C19.4 2 20.6 2 21.2 3.5 C25 13 28.5 38 27.5 58 Z",
    canals: ["M20 56 C20 38 20 20 20 7"],
    occlusal: { rx: 7, ry: 7, w: 22, h: 14 },
  },
  premolar: {
    crown:
      "M11 58 C7.5 63 6.5 72 7.5 82 C8 88 10 91 12.5 92.5 C14.5 95.5 17 95 19 92.5 L21 92.5 C23 95 25.5 95.5 27.5 92.5 C30 91 32 88 32.5 82 C33.5 72 32.5 63 29 58 Z",
    root: "M11 58 C10 40 13 19 17.8 8.5 C19 6 21 6 22.2 8.5 C27 19 30 40 29 58 Z",
    canals: ["M20 56 C20 40 20 24 20 12"],
    occlusal: { rx: 9.5, ry: 9.5, w: 25, h: 19 },
  },
  molar: {
    crown:
      "M7.5 58 C3.5 63 2.5 72 3.5 82 C4 88 5.5 91.5 8 92.5 C10 95.5 13 95.5 15 92.5 C17 91.5 18.5 91.5 20 92.5 C21.5 91.5 23 91.5 25 92.5 C27 95.5 30 95.5 32 92.5 C34.5 91.5 36 88 36.5 82 C37.5 72 36.5 63 32.5 58 Z",
    root: "M7.5 58 C5.5 42 6 24 9.5 12 C10.8 8 14 8.5 14.5 13 C15.5 24 16.5 33 20 40 C23.5 33 24.5 24 25.5 13 C26 8.5 29.2 8 30.5 12 C34 24 34.5 42 32.5 58 Z",
    canals: ["M12 56 C11.5 42 11 26 11.5 14", "M28 56 C28.5 42 29 26 28.5 14"],
    occlusal: { rx: 11, ry: 11, w: 30, h: 26 },
  },
}

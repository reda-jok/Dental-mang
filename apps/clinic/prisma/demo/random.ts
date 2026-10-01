// Deterministic randomness: the same demo data on every run (mulberry32).

let state = 20260929

export function rand() {
  state |= 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!
export const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
export const chance = (p: number) => rand() < p

/** Picks by weight: weighted([["cash", 6], ["card", 2]]). */
export function weighted<T>(options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [value, w] of options) {
    if ((r -= w) < 0) return value
  }
  return options[options.length - 1]![0]
}

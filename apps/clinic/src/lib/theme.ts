/** Light or dark (Tamkeen Clear), chosen per device and kept in this cookie. */
export const THEME_COOKIE = "theme"
export type Theme = "light" | "dark"

/** Dark only when chosen, and never on printouts (paper is always light). */
export function themeFor(cookie: string | undefined, pathname: string | null): Theme {
  return cookie === "dark" && !pathname?.startsWith("/print") ? "dark" : "light"
}

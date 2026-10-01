// Languages the UI is translated into (one messages/<language>.json each).
export const languages = ["ar"] as const
export type Language = (typeof languages)[number]
export const defaultLanguage: Language = "ar"

/**
 * The locale used for formatting: the language with Western digits forced
 * ("-u-nu-latn"), so dates, numbers and money show 123 everywhere — on the server
 * and in every browser — while month names, plurals and RTL stay Arabic (decision D6).
 */
export type Locale = `${Language}-u-nu-latn`
export const toLocale = (language: Language): Locale => `${language}-u-nu-latn`
export const languageOf = (locale: string): Language =>
  (languages as readonly string[]).includes(locale.split("-")[0]!)
    ? (locale.split("-")[0] as Language)
    : defaultLanguage

const rtlLanguages: ReadonlySet<Language> = new Set(["ar"])
export const directionOf = (locale: string) =>
  rtlLanguages.has(languageOf(locale)) ? "rtl" : "ltr"

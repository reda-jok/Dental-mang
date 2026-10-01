import { getRequestConfig } from "next-intl/server"

import { defaultLanguage, toLocale } from "@/i18n/config"

// The language is a clinic/user setting, not part of the URL. Arabic only for now;
// English and Kurdish are added by extending `languages` and reading the preference here.
export default getRequestConfig(async () => {
  const language = defaultLanguage
  return {
    locale: toLocale(language),
    timeZone: process.env.CLINIC_TIMEZONE ?? "Asia/Baghdad",
    messages: (await import(`../../messages/${language}.json`)).default,
  }
})

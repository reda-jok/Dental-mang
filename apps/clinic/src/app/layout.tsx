import type { Metadata } from "next"
import { Readex_Pro } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { cookies, headers } from "next/headers"

import { DirectionProvider } from "@/components/ui/direction"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { directionOf, languageOf } from "@/i18n/config"
import { THEME_COOKIE, themeFor } from "@/lib/theme"

import "./globals.css"

// Readex Pro (variable weight) for every word, Arabic and Latin: the Tamkeen Clear face.
// Downloaded at build time and served locally — no internet needed at runtime.
const font = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-sans" })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app")
  return { title: { default: t("name"), template: `%s · ${t("name")}` }, description: t("tagline") }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  const dir = directionOf(locale)
  // Set on the server, so the page never flashes light before turning dark.
  const theme = themeFor(
    (await cookies()).get(THEME_COOKIE)?.value,
    (await headers()).get("x-pathname"),
  )

  return (
    <html
      lang={languageOf(locale)}
      dir={dir}
      className={`${font.variable} h-full antialiased ${theme === "dark" ? "dark" : ""}`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster position="top-center" richColors theme={theme} />
            </TooltipProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

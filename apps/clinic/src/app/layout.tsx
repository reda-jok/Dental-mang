import type { Metadata } from "next"
import { IBM_Plex_Sans_Arabic } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"

import { DirectionProvider } from "@/components/ui/direction"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { directionOf, languageOf } from "@/i18n/config"

import "./globals.css"

// Downloaded at build time and served locally — no internet needed at runtime.
const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app")
  return { title: { default: t("name"), template: `%s · ${t("name")}` }, description: t("tagline") }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  const dir = directionOf(locale)

  return (
    <html lang={languageOf(locale)} dir={dir} className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster position="top-center" richColors />
            </TooltipProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

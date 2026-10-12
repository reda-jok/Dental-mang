import { getTranslations } from "next-intl/server"

import { Logo } from "@/components/logo"

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app")
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo title={t("company")} className="h-20" />
        <div>
          <h1 className="font-display text-2xl text-slate-900">{t("name")}</h1>
          <p className="text-sm text-slate-500">{t("tagline")}</p>
        </div>
      </div>
      <div className="w-full max-w-sm [&>[data-slot=card]]:shadow-sm">{children}</div>
    </main>
  )
}

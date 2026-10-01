import { StethoscopeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app")
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-600 shadow-md">
          <StethoscopeIcon className="size-6 text-white" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("name")}</h1>
          <p className="text-sm text-slate-500">{t("tagline")}</p>
        </div>
      </div>
      <div className="w-full max-w-sm [&>[data-slot=card]]:rounded-2xl [&>[data-slot=card]]:shadow-sm">
        {children}
      </div>
    </main>
  )
}

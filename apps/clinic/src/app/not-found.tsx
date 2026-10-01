import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default async function NotFound() {
  const t = await getTranslations("errorPage")
  return (
    <main className="mx-auto max-w-md space-y-3 py-24 text-center">
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundDescription")}</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">{t("home")}</Link>
      </Button>
    </main>
  )
}

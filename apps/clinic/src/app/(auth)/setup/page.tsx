import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SetupForm } from "@/features/setup/components/setup-form"
import { isSetupComplete } from "@/features/setup/service"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup")
  return { title: t("title") }
}

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login")

  const t = await getTranslations("setup")
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SetupForm />
      </CardContent>
    </Card>
  )
}

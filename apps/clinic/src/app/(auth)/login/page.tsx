import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/features/auth/components/login-form"
import { isSetupComplete } from "@/features/setup/service"
import { getCurrentUser } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth")
  return { title: t("loginTitle") }
}

export default async function LoginPage() {
  if (!(await isSetupComplete())) redirect("/setup")
  if (await getCurrentUser()) redirect("/dashboard")

  const t = await getTranslations("auth")
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}

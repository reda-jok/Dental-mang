import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { Building2Icon } from "lucide-react"
import { Panel } from "@/components/panel"

import { ClinicSettingsForm } from "@/features/settings/components/clinic-settings-form"
import { getClinicSettingsForEdit } from "@/features/settings/data"
import { hasPermission } from "@/lib/permissions"
import { requireUser } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings")
  return { title: t("clinicTab") }
}

export default async function ClinicSettingsPage() {
  const [user, settings, t] = await Promise.all([
    requireUser(),
    getClinicSettingsForEdit(),
    getTranslations("settings"),
  ])
  if (!settings) notFound()

  return (
    <Panel icon={Building2Icon} title={t("clinicTab")} description={t("clinicDescription")}>
      <ClinicSettingsForm initial={settings} canEdit={hasPermission(user.role, "settings:write")} />
    </Panel>
  )
}

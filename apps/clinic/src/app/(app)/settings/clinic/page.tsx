import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { Building2Icon } from "lucide-react"
import { Panel } from "@/components/panel"

import { ClinicLogoField } from "@/features/settings/components/clinic-logo-field"
import { ClinicSettingsForm } from "@/features/settings/components/clinic-settings-form"
import { getClinicSettingsForEdit, logoUrl } from "@/features/settings/data"
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
      <div className="space-y-8">
        <ClinicLogoField
          logoUrl={logoUrl(settings.logoFile)}
          canEdit={hasPermission(user, "settings:write")}
        />
        <ClinicSettingsForm initial={settings} canEdit={hasPermission(user, "settings:write")} />
      </div>
    </Panel>
  )
}

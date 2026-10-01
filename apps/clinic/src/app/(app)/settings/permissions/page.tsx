import { ShieldCheckIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { PermissionSettings } from "@/features/permissions/components/permission-settings"
import { getPermissionSettings } from "@/features/permissions/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("permissions")
  return { title: t("title") }
}

export default async function PermissionsSettingsPage() {
  await requirePagePermission("settings:permissions")
  const [settings, t] = await Promise.all([getPermissionSettings(), getTranslations("permissions")])
  return (
    <Panel icon={ShieldCheckIcon} title={t("title")} description={t("description")}>
      <PermissionSettings settings={settings} />
    </Panel>
  )
}

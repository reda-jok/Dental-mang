import { SwatchBookIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { ConditionsManager } from "@/features/chart/components/conditions-manager"
import { getConditionsForSettings } from "@/features/chart/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("toothConditions")
  return { title: t("title") }
}

export default async function ConditionsSettingsPage() {
  const user = await requirePagePermission("settings:read")
  const [conditions, t] = await Promise.all([
    getConditionsForSettings(),
    getTranslations("toothConditions"),
  ])
  return (
    <Panel icon={SwatchBookIcon} title={t("title")} description={t("description")}>
      <ConditionsManager
        conditions={conditions}
        canEdit={hasPermission(user.role, "settings:write")}
      />
    </Panel>
  )
}

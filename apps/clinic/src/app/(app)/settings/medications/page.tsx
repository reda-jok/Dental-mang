import { PillIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { MedicationsManager } from "@/features/prescriptions/components/medications-manager"
import { getMedicationsForSettings } from "@/features/prescriptions/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("medications")
  return { title: t("title") }
}

export default async function MedicationsSettingsPage() {
  const user = await requirePagePermission("settings:read")
  const [medications, t] = await Promise.all([
    getMedicationsForSettings(),
    getTranslations("medications"),
  ])
  return (
    <Panel icon={PillIcon} title={t("title")} description={t("description")}>
      <MedicationsManager
        medications={medications}
        canEdit={hasPermission(user.role, "settings:write")}
      />
    </Panel>
  )
}

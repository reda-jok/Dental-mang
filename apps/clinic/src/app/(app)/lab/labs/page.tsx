import { BuildingIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { LabsManager } from "@/features/lab/components/labs-manager"
import { getLabs } from "@/features/lab/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lab")
  return { title: t("tabs.labs") }
}

export default async function LabsPage() {
  const user = await requirePagePermission("lab:read")
  const [labs, t] = await Promise.all([getLabs(), getTranslations("lab")])
  return (
    <Panel icon={BuildingIcon} title={t("tabs.labs")} description={t("labsDescription")}>
      <LabsManager labs={labs} canEdit={hasPermission(user.role, "lab:write")} />
    </Panel>
  )
}

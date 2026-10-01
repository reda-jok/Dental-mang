import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ListChecksIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { CatalogManager } from "@/features/procedures/components/catalog-manager"
import { getCatalogForSettings } from "@/features/procedures/data"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("procedures")
  return { title: t("title") }
}

export default async function ProceduresSettingsPage({
  searchParams,
}: PageProps<"/settings/procedures">) {
  const user = await requirePagePermission("settings:read")
  const [catalog, t] = await Promise.all([getCatalogForSettings(), getTranslations("procedures")])
  return (
    <Panel icon={ListChecksIcon} title={t("title")} description={t("description")}>
      <CatalogManager
        catalog={catalog}
        canEdit={hasPermission(user.role, "settings:write")}
        // The header's "add procedure" button links here with ?new=1.
        openNew={(await searchParams).new === "1"}
      />
    </Panel>
  )
}

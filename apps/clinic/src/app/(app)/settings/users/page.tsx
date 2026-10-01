import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { UsersIcon } from "lucide-react"
import { Panel } from "@/components/panel"

import { UsersTable } from "@/features/users/components/users-table"
import { listStaff } from "@/features/users/data"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users")
  return { title: t("title") }
}

export default async function UsersPage() {
  const user = await requirePagePermission("user:list")
  const [rows, t] = await Promise.all([listStaff(), getTranslations("users")])

  return (
    <Panel icon={UsersIcon} title={t("title")} description={t("description")}>
      <UsersTable rows={rows} actor={{ id: user.id, role: user.role }} />
    </Panel>
  )
}

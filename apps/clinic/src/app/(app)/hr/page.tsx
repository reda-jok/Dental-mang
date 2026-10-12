import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { Panel } from "@/components/panel"
import { UsersTable } from "@/features/users/components/users-table"
import { listStaff } from "@/features/users/data"
import { hasPermission } from "@/lib/permissions"
import { getCurrentUser, requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users")
  return { title: t("title") }
}

/** The employee list. Someone who only sees pay (a dentist) lands on their commission. */
export default async function EmployeesPage() {
  const current = await getCurrentUser()
  if (current && !hasPermission(current, "user:list") && hasPermission(current, "hr:self")) {
    redirect("/hr/commission")
  }
  const user = await requirePagePermission("user:list")
  const [rows, t] = await Promise.all([listStaff(), getTranslations("users")])

  return (
    <Panel icon={UsersIcon} title={t("title")} description={t("description")}>
      <UsersTable rows={rows} actor={{ id: user.id, role: user.role }} />
    </Panel>
  )
}

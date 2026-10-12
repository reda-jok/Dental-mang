import { SettingsNav } from "@/features/settings/components/settings-nav"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const user = await requirePagePermission("settings:read")

  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      <SettingsNav
        showUsers={hasPermission(user, "user:list")}
        showPermissions={hasPermission(user, "settings:permissions")}
      />
      {children}
    </div>
  )
}

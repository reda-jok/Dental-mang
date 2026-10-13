import { AccountingNav } from "@/features/accounting/components/accounting-nav"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export default async function AccountingLayout({ children }: LayoutProps<"/accounting">) {
  const user = await requirePagePermission("accounting:read")
  return (
    <div className="space-y-6">
      {/* The page title is in the header; the report tabs only for those who see reports. */}
      {hasPermission(user, "accounting:reports") && <AccountingNav />}
      {children}
    </div>
  )
}

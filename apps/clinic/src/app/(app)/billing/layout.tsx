import { BillingNav } from "@/features/billing/components/billing-nav"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export default async function BillingLayout({ children }: LayoutProps<"/billing">) {
  const user = await requirePagePermission("billing:read")
  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      <BillingNav showDebts={hasPermission(user.role, "billing:write")} />
      {children}
    </div>
  )
}

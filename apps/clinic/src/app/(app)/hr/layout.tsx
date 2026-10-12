import { HrNav } from "@/features/hr/components/hr-nav"
import { hasPermission } from "@/lib/permissions"
import { getCurrentUser } from "@/server/session"

export default async function HrLayout({ children }: LayoutProps<"/hr">) {
  // Each page checks its own permission; the tabs show only when there are two.
  const user = await getCurrentUser()
  const staff = hasPermission(user, "user:list")
  const pay = hasPermission(user, "hr:self")
  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      {staff && pay && <HrNav />}
      {children}
    </div>
  )
}

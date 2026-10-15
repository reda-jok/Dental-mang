import { TreatmentsNav } from "@/features/treatments/components/treatments-nav"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export default async function TreatmentsLayout({ children }: LayoutProps<"/treatments">) {
  const user = await requirePagePermission("treatments:read")
  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      <TreatmentsNav reports={hasPermission(user, "treatments:reports")} />
      {children}
    </div>
  )
}

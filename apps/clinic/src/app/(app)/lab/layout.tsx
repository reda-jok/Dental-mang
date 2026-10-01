import { LabNav } from "@/features/lab/components/lab-nav"
import { can } from "@/server/permissions"
import { requirePagePermission } from "@/server/session"

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  const user = await requirePagePermission("lab:read")
  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      <LabNav accounts={await can(user, "lab:pay")} />
      {children}
    </div>
  )
}

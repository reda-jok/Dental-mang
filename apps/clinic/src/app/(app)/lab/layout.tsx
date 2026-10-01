import { LabNav } from "@/features/lab/components/lab-nav"
import { requirePagePermission } from "@/server/session"

export default async function LabLayout({ children }: LayoutProps<"/lab">) {
  await requirePagePermission("lab:read")
  return (
    <div className="space-y-6">
      {/* The page title is in the header. */}
      <LabNav />
      {children}
    </div>
  )
}

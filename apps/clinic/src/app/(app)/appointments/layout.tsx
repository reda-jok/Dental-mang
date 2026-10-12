import { AppointmentsNav } from "@/features/reminders/components/appointments-nav"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

/** Tabs only for those who send reminders (anyone who books appointments). */
export default async function AppointmentsLayout({ children }: LayoutProps<"/appointments">) {
  const user = await requirePagePermission("appointment:read")
  if (!hasPermission(user, "appointment:write")) return children
  return (
    <div className="space-y-6">
      <AppointmentsNav />
      {children}
    </div>
  )
}

import { redirect } from "next/navigation"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { HeaderSearch } from "@/components/layout/header-search"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { BookingProvider } from "@/features/appointments/components/booking-provider"
import { getBookingOptions, getScheduleConfig } from "@/features/appointments/data"
import { getClinicSettings } from "@/features/settings/data"
import { hasPermission } from "@/lib/permissions"
import { getCurrentUser } from "@/server/session"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const settings = await getClinicSettings()
  if (!settings) redirect("/setup")

  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // Quick actions in the header, only for users who can use them.
  const actions = [
    ...(hasPermission(user.role, "patient:write") ? (["newPatient"] as const) : []),
    ...(hasPermission(user.role, "appointment:write") ? (["newAppointment"] as const) : []),
    ...(hasPermission(user.role, "settings:write") ? (["newProcedure"] as const) : []),
  ]

  const canBook = hasPermission(user.role, "appointment:write")
  const [config, bookingOptions] = await Promise.all([
    getScheduleConfig(),
    canBook ? getBookingOptions() : null,
  ])

  return (
    <BookingProvider options={bookingOptions} config={config}>
      <SidebarProvider>
        <AppSidebar clinicName={settings.name} user={{ name: user.name, role: user.role }} />
        <SidebarInset className="bg-background">
          <AppHeader
            search={hasPermission(user.role, "patient:read") ? <HeaderSearch /> : undefined}
            actions={actions}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </BookingProvider>
  )
}

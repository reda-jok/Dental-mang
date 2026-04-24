"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, FileText, DollarSign } from "lucide-react"
import { CalendarSection } from "@/app/components/calendar-section"
import { usePatients } from "@/hooks/use-patients"
import { useAppointments } from "@/hooks/use-appointments"

export default function DashboardPage() {
  const { patients, isLoading: pLoading } = usePatients()
  const { appointments, isLoading: aLoading } = useAppointments()

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter((a) => a.date?.slice(0, 10) === todayStr)

  const stats = [
    {
      title: "Total Patients",
      value: pLoading ? "…" : patients.length.toString(),
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Today's Appointments",
      value: aLoading ? "…" : todayAppts.length.toString(),
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: "Procedures This Month",
      value: aLoading ? "…" : appointments.length.toString(),
      icon: FileText,
      color: "text-purple-600",
    },
    {
      title: "Monthly Revenue",
      value: "$0",
      icon: DollarSign,
      color: "text-orange-600",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Badge variant="secondary" className="text-xs mt-1">
                Live data
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar */}
      <CalendarSection />

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments list */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <CardDescription>Scheduled for {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</CardDescription>
          </CardHeader>
          <CardContent>
            {aLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : todayAppts.length === 0 ? (
              <p className="text-sm text-gray-500">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{apt.patientName}</p>
                      <p className="text-xs text-gray-500">{apt.procedureName ?? "—"} · {apt.time}</p>
                    </div>
                    <Badge
                      variant={apt.status === "completed" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Practice overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Active Patients", value: patients.filter((p) => p.status === "Active").length },
                { label: "Pending Appointments", value: appointments.filter((a) => a.status === "pending").length },
                { label: "In-Progress", value: appointments.filter((a) => a.status === "in-progress").length },
                { label: "Completed Today", value: todayAppts.filter((a) => a.status === "completed").length },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="font-bold">{pLoading || aLoading ? "…" : item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, MapPin, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { useAppointments, useUpdateAppointmentStatus } from "@/hooks/use-appointments"

const formatDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const getBadgeClasses = (status: string) => {
  if (status === "pending") return "border border-yellow-500 text-yellow-600 bg-yellow-50"
  if (status === "in-progress") return "border border-blue-500 text-blue-600 bg-blue-50"
  if (status === "completed") return "bg-green-500/50 text-green-800"
  if (status === "cancelled") return "bg-red-500/50 text-red-800"
  return ""
}

export function AppointmentScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week">("day")

  const { appointments, restDays, isLoading, error } = useAppointments()
  const updateStatus = useUpdateAppointmentStatus()

  const currentDateFormatted = formatDateKey(currentDate)
  const isRestDay = restDays.includes(currentDateFormatted)

  const filteredAppointments = appointments.filter(
    (apt) => apt.date?.slice(0, 10) === currentDateFormatted,
  )

  const navigateDate = (direction: "prev" | "next") => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + (direction === "next" ? 1 : -1))
    setCurrentDate(d)
  }

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

  const uniqueTimeSlots = Array.from(new Set(filteredAppointments.map((a) => a.time)))

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-500">Loading appointments…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Appointment Scheduler</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium min-w-[220px] text-center text-sm">
                  {formatDate(currentDate)}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={view === "day" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("day")}
                >
                  Day
                </Button>
                <Button
                  variant={view === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("week")}
                >
                  Week
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Rest day banner */}
      {isRestDay ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center justify-center py-8">
              <Clock className="w-12 h-12 text-red-500 mb-2" />
              <span className="text-red-600 font-medium">Rest Day — Clinic Closed</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Time slots sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Booked Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {uniqueTimeSlots.length === 0 ? (
                  <p className="text-sm text-gray-400">No appointments</p>
                ) : (
                  uniqueTimeSlots.map((time) => {
                    const atThisTime = filteredAppointments.filter((a) => a.time === time)
                    return (
                      <div key={`${currentDateFormatted}-${time}`} className="p-2 rounded-lg border text-sm">
                        <div className="font-medium">{time}</div>
                        {atThisTime.map((apt) => (
                          <Badge
                            key={apt.id}
                            className={`text-xs mt-1 block ${getBadgeClasses(apt.status)}`}
                          >
                            {apt.patientName} — {apt.procedureName ?? apt.procedure}
                          </Badge>
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Appointment cards */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  Today's Appointments ({filteredAppointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    No appointments for this day.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{appointment.time}</span>
                                <span className="text-sm text-gray-500">
                                  ({appointment.duration} min)
                                </span>
                              </div>
                              <Badge className={`text-sm ${getBadgeClasses(appointment.status)}`}>
                                {appointment.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium">{appointment.patientName}</span>
                                </div>
                                <p className="text-sm text-gray-500 ml-6">
                                  {appointment.procedureName ?? appointment.procedure ?? "—"}
                                </p>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm">
                                    {appointment.doctorName ?? appointment.dentist ?? "—"} ·{" "}
                                    {appointment.room ?? "—"}
                                  </span>
                                </div>
                                {appointment.notes && (
                                  <p className="text-sm text-gray-500 ml-6">{appointment.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 ml-4">
                            {appointment.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updateStatus.isPending}
                                onClick={() =>
                                  updateStatus.mutate({ id: appointment.id, status: "in-progress" })
                                }
                              >
                                Start
                              </Button>
                            )}
                            {appointment.status === "in-progress" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updateStatus.isPending}
                                onClick={() =>
                                  updateStatus.mutate({ id: appointment.id, status: "completed" })
                                }
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, MapPin, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

interface Appointment {
  appointmentId: string;
  createdAt: string;
  date: string;
  dentist: string;
  duration: number;
  id: number;
  notes: string | null;
  patient: string;
  patientId: number;
  priority: string;
  procedure: string;
  room: string;
  status: string;
  time: string;
}

export function AppointmentScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"day" | "week">("day")

  return <AppointmentsList currentDate={currentDate} setCurrentDate={setCurrentDate} view={view} setView={setView} />
}

function AppointmentsList({
  currentDate,
  setCurrentDate,
  view,
  setView,
}: {
  currentDate: Date
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>
  view: "day" | "week"
  setView: React.Dispatch<React.SetStateAction<"day" | "week">>
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const response = await fetch("./api/appointments")
      const data = await response.json()
      if (data.success) {
        // Default to pending if status is not set
        const normalized = data.appointments.map((apt: Appointment) => ({
          ...apt,
          status: apt.status === "in-progress" || apt.status === "completed" ? apt.status : "pending"
        }))
        setAppointments(normalized)
        setError("")
      } else {
        setError(data.error || "Failed to fetch appointments")
      }
    } catch (err) {
      setError("Failed to connect to database")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [])

const updateAppointmentStatus = async (id: number, status: "pending" | "in-progress" | "completed") => {
  try {
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    })

    const data = await res.json()
    if (data.success) {
      setAppointments(prev =>
        prev.map(apt => apt.id === id ? { ...apt, status } : apt)
      )
    } else {
      alert("Failed to update status: " + data.error)
    }
  } catch (error) {
    console.error("Error updating status:", error)
    alert("Error updating status")
  }
}


  const getLocalDatePart = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalDateFromISO = (isoString: string): string => {
    const date = new Date(isoString);
    return getLocalDatePart(date);
  };

  const currentDateFormatted = getLocalDatePart(currentDate);

  const filteredAppointments = appointments.filter((apt) => {
    const aptDate = getLocalDateFromISO(apt.date);
    return aptDate === currentDateFormatted;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading appointments...</p>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1))
    setCurrentDate(newDate)
  }

  const uniqueTimeSlots = Array.from(new Set(filteredAppointments.map(apt => apt.time)));

  const getBadgeClasses = (status: string) => {
    if (status === "pending") return "border border-red-500 text-red-600 bg-red-50"
    if (status === "in-progress") return "border border-blue-500 text-blue-600 bg-blue-50"
    if (status === "completed") return "bg-green-500/50 text-green-800"
    return ""
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Appointment Scheduler</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium min-w-[200px] text-center">{formatDate(currentDate)}</span>
                <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => setView("day")}>
                  Day
                </Button>
                <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>
                  Week
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Booked Times</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uniqueTimeSlots.map((time) => {
                const appointmentsAtThisTime = filteredAppointments.filter(apt => apt.time === time);
                return (
                  <div
                    key={`${currentDateFormatted}-${time}`}
                    className="p-2 rounded-lg border text-sm"
                  >
                    <div className="font-medium">{time}</div>
                    {appointmentsAtThisTime.map(appointment => (
                      <Badge
                        key={appointment.id}
                        className={`text-xs mt-1 block ${getBadgeClasses(appointment.status)}`}
                      >
                        {appointment.patient} - {appointment.procedure} ({appointment.status})
                      </Badge>
                    ))}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Appointments ({filteredAppointments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{appointment.time}</span>
                            <span className="text-sm text-gray-500">({appointment.duration} min)</span>
                          </div>
                          <Badge className={`text-sm ${getBadgeClasses(appointment.status)}`}>
                            {appointment.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{appointment.patient}</span>
                            </div>
                            <p className="text-sm text-gray-600 ml-6">{appointment.procedure}</p>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">
                                {appointment.dentist} • {appointment.room}
                              </span>
                            </div>
                            {appointment.notes && <p className="text-sm text-gray-600 ml-6">{appointment.notes}</p>}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        {appointment.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => updateAppointmentStatus(appointment.id, "in-progress")}>
                            Start
                          </Button>
                        )}
                        {appointment.status === "in-progress" && (
                          <Button variant="outline" size="sm" onClick={() => updateAppointmentStatus(appointment.id, "completed")}>
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

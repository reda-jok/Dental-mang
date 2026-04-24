"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Coffee, RefreshCw } from "lucide-react"
import { DayViewModal } from "./day-view-modal"
import { useAppointments } from "@/hooks/use-appointments"
interface Appointment {
  id: number
  appointmentId: string
  patient: string
  time: string
  procedure: string
  status: string
  dentist: string
  room: string
  date: string
}

export function CalendarSection() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"week" | "month">("month")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showDayView, setShowDayView] = useState(false)
  const [restDays, setRestDays] = useState<Set<string>>(new Set())
  const { appointments, setAppointments, isLoading } = useAppointments({})
  const [loading, setLoading] = useState(true)

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fetch appointments + rest days dynamically
  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const monthKey = formatDateKey(currentDate).slice(0, 7) // YYYY-MM
      const response = await fetch(`/api/appointments?month=${monthKey}`)
      const data = await response.json()
      console.log('Fetched appointments data:', data)
      if (data.success) {
        setAppointments(data.appointments)
        // Fetch the holiday data to mark rest days
        const holidaysResponse = await fetch(`/api/clinic/holidayes`)
        const holidaysData = await holidaysResponse.json()
        if (holidaysData.success) {
          const holidayDates = holidaysData.holidays.map((h: any) => h.date.slice(0, 10)) // Extract YYYY-MM-DD
          setRestDays(new Set(holidayDates))
        } else {
          console.error("Failed to fetch holidays:", holidaysData.error)
        }
      } else {
        console.error("Failed to fetch appointments:", data.error)
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [currentDate])

  // Convert ISO date to local YYYY-MM-DD
  const getLocalDateFromISO = (isoString: string) => {
    const date = new Date(isoString)
    return formatDateKey(date)
  }

  const getAppointmentsForDate = (date: Date) => {
    const dateKey = formatDateKey(date)
    return appointments.filter(apt => getLocalDateFromISO(apt.date) === dateKey)
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1))
    } else {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    }
    setCurrentDate(newDate)
  }

  const getMonthDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const currentDateObj = new Date(startDate)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDateObj))
      currentDateObj.setDate(currentDateObj.getDate() + 1)
    }
    return days
  }

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth()

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setShowDayView(true)
  }

  const formatMonthYear = () => currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const formatWeekRange = () => {
    const weekDays = getWeekDays()
    const start = weekDays[0]
    const end = weekDays[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`
    } else {
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${start.getFullYear()}`
    }
  }

  const handleRestDayChange = async (date: Date, isRestDay: boolean) => {
    const dateKey = formatDateKey(date)
    try {
      await fetch(`/api/clinic/holidayes`, {
        method: isRestDay ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey }),
      })
      const newRestDays = new Set(restDays)
      isRestDay ? newRestDays.add(dateKey) : newRestDays.delete(dateKey)
      setRestDays(newRestDays)
    } catch (err) {
      console.error("Failed to update rest day:", err)
    }
  }

  const isRestDay = (date: Date) => restDays.has(formatDateKey(date))

  const days = view === "month" ? getMonthDays() : getWeekDays()
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Appointment Calendar</CardTitle>
            <div className="flex items-center gap-4">
              <Button onClick={fetchAppointments} variant="outline" size="sm" className="gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="font-medium min-w-[200px] text-center">{view === "month" ? formatMonthYear() : formatWeekRange()}</span>
                <Button variant="outline" size="sm" onClick={() => navigateDate("next")}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <div className="flex gap-2">
                <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>Week</Button>
                <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>Month</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading appointments...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`grid grid-cols-7 gap-2`}>
                {weekDays.map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">{day}</div>
                ))}
              </div>

              <div className={`grid grid-cols-7 gap-2`}>
                {days.map((date, index) => {
                  const dayAppointments = getAppointmentsForDate(date)
                  const isCurrentMonthDay = view === "week" || isCurrentMonth(date)
                  const dayIsRest = isRestDay(date)

                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(date)}
                      className={`
                        min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50
                        ${isToday(date) ? "bg-blue-50 border-blue-200" : "border-gray-200"}
                        ${dayIsRest ? "bg-red-50 border-red-200" : ""}
                        ${!isCurrentMonthDay ? "opacity-40" : ""}
                      `}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isToday(date) ? "text-blue-700" : dayIsRest ? "text-red-700" : isCurrentMonthDay ? "text-gray-900" : "text-gray-400"}`}>
                          {date.getDate()}
                        </span>
                        <div className="flex items-center gap-1">
                          {dayIsRest && <Coffee className="w-3 h-3 text-red-600" />}
                          {dayAppointments.length > 0 && !dayIsRest && <Badge variant="secondary" className="text-xs">{dayAppointments.length}</Badge>}
                        </div>
                      </div>

                      {!dayIsRest && (
                        <div className="space-y-1">
                          {dayAppointments.slice(0, view === "month" ? 2 : 4).map((apt, aptIndex) => (
                            <div key={aptIndex} className={`text-xs p-1 rounded truncate ${apt.status === "completed" ? "bg-green-100 text-green-700" : apt.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                              <div className="font-medium">{apt.time}</div>
                              <div className="truncate">{apt.patient}</div>
                            </div>
                          ))}
                          {dayAppointments.length > (view === "month" ? 2 : 4) && (
                            <div className="text-xs text-gray-500 text-center">
                              +{dayAppointments.length - (view === "month" ? 2 : 4)} more
                            </div>
                          )}
                        </div>
                      )}

                      {dayIsRest && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Coffee className="w-6 h-6 text-red-600 mx-auto mb-1" />
                            <span className="text-xs text-red-600 font-medium">Rest Day</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day View Modal */}
      <DayViewModal
        open={showDayView}
        onOpenChange={setShowDayView}
        selectedDate={selectedDate}
        appointments={selectedDate ? getAppointmentsForDate(selectedDate) : []}
        isRestDay={selectedDate ? isRestDay(selectedDate) : false}
        onRestDayChange={(isRest) => selectedDate && handleRestDayChange(selectedDate, isRest)}
        onAppointmentAdded={fetchAppointments}
      />
    </>
  )
}

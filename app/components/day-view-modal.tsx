"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Coffee } from "lucide-react"

import type { Appointment } from "@/types"

interface DayViewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date | null
  appointments: Appointment[]
  isRestDay: boolean
  onRestDayChange: (isRestDay: boolean) => void
  onAppointmentAdded: () => void
}

export function DayViewModal({
  open,
  onOpenChange,
  selectedDate,
  appointments,
  isRestDay,
  onRestDayChange,
  onAppointmentAdded,
}: DayViewModalProps) {

  const formatDate = (date: Date | null) => {
    if (!date) return ""
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  }

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getBadgeClasses = (status: string) => {
    if (status === "confirmed") return "bg-green-100 text-green-700"
    if (status === "pending") return "bg-yellow-100 text-yellow-700"
    if (status === "rest-day") return "bg-red-100 text-red-700"
    return "bg-blue-100 text-blue-700"
  }

const handleRestDayToggle = async (checked: boolean) => {
  if (!selectedDate) return

  try {
    // Update local state & refresh calendar
    onRestDayChange(checked)
    onAppointmentAdded()
  } catch (err) {
    console.error("Failed to toggle rest day:", err)
  }
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md transition-colors ${isRestDay ? "bg-red-50 border border-red-200" : "bg-white"}`}
      >
        <DialogHeader>
          <DialogTitle>{formatDate(selectedDate)}</DialogTitle>
          <DialogDescription>
            View and manage appointments for this day. Toggle Rest Day if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rest Day Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rest Day</span>
            <Switch checked={isRestDay} onCheckedChange={handleRestDayToggle} />
          </div>

          {/* Rest Day Visual */}
          {isRestDay && (
            <div className="flex flex-col items-center justify-center py-8">
              <Coffee className="w-12 h-12 text-red-600 mb-2" />
              <span className="text-red-600 font-medium">Rest Day</span>
            </div>
          )}

          {/* Appointments List */}
          {!isRestDay && appointments.length === 0 && (
            <p className="text-sm text-gray-500">No appointments for this day.</p>
          )}

          <div className="space-y-2">
            {!isRestDay && appointments.map((apt) => (
              <div key={apt.id} className={`p-2 rounded ${getBadgeClasses(apt.status)}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{apt.time}</span>
                  <Badge className={`text-xs ${getBadgeClasses(apt.status)}`}>{apt.status}</Badge>
                </div>
                <div className="text-sm truncate">{apt.patient}</div>
                <div className="text-sm truncate">{apt.procedure}</div>
              </div>
            ))}
          </div>

          {!isRestDay && (
            <Button variant="outline" className="w-full" onClick={onAppointmentAdded}>
              Refresh Appointments
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

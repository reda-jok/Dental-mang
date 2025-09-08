"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { WhatsAppService } from "../utils/whatsapp"
import { WhatsAppMessageModal } from "./whatsapp-message-modal"

interface AddAppointmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefilledDate?: string
  prefilledTime?: string
  onAppointmentAdded?: () => void
}

interface Appointment {
  id: number
  appointmentId: string
  patientId: number
  patient: string
  date: string
  time: string
  duration: number
  dentist: string
  room: string | null
  procedure: string
  status: string
  priority: string
  notes: string | null
}

interface Patient {
  id: number
  name: string
  phone?: string
}

export function AddAppointmentModal({
  open,
  onOpenChange,
  prefilledDate = "",
  prefilledTime = "",
  onAppointmentAdded,
}: AddAppointmentModalProps) {
  const [formData, setFormData] = useState({
    patient: "",
    date: "",
    time: "",
    duration: "60",
    procedure: "",
    dentist: "",
    room: "",
    notes: "",
    priority: "normal",
  })

  const [patients, setPatients] = useState<Patient[]>([])
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([])
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [patientSearch, setPatientSearch] = useState("")
  const [selectedPatientPhone, setSelectedPatientPhone] = useState("")
  const [sendWhatsApp, setSendWhatsApp] = useState(true)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsAppMessage, setWhatsAppMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const procedures = [
    "Routine Cleaning",
    "Deep Cleaning",
    "Filling",
    "Crown Placement",
    "Root Canal",
    "Tooth Extraction",
    "Teeth Whitening",
    "Consultation",
  ]

  const dentists = ["Dr. Ali", "Muslim", "Bahaa"]
  const rooms = ["Room 1", "Room 2"]

  const timeSlots = [
    "03:30", "04:00", "04:30", "05:00", "05:30", "06:00",
    "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"
  ]

  // Fetch patients
  useEffect(() => {
    if (!open) return
    const fetchPatients = async () => {
      try {
        const res = await fetch("/api/patients")
        const data = await res.json()
        if (data.success) setPatients(data.patients)
      } catch (err) {
        console.error(err)
      }
    }
    fetchPatients()
  }, [open])

  // Fetch existing appointments for selected date
  useEffect(() => {
    if (!formData.date) return
    setLoadingAppointments(true)
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`/api/appointments?date=${formData.date}`)
        const data = await res.json()
        if (data.success) setExistingAppointments(data.appointments)
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingAppointments(false)
      }
    }
    fetchAppointments()
  }, [formData.date])

  const availableTimeSlots = useMemo(() => {
    return timeSlots.filter(
      (t) => !existingAppointments.some((apt) => apt.time === t)
    )
  }, [existingAppointments])

  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => p.name.toLowerCase().includes(patientSearch.toLowerCase()))
      .map((p) => {
        const hasAppointment = existingAppointments.some(
          (apt) => apt.patientId === p.id
        )
        return { ...p, hasAppointment }
      })
  }, [patients, patientSearch, existingAppointments])

  const handlePatientSelect = (patient: Patient) => {
    setFormData({ ...formData, patient: patient.name })
    setSelectedPatientPhone(patient.phone || "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.date || !formData.time || !formData.patient) {
      setError("Date, time, and patient are required")
      return
    }
    setIsSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        if (sendWhatsApp && selectedPatientPhone) {
          const message = WhatsAppService.generateAppointmentScheduledMessage(
            formData.patient,
            formData.date,
            formData.time,
            formData.procedure,
            formData.dentist
          )
          setWhatsAppMessage(message)
          setShowWhatsAppModal(true)
        } else {
          alert(data.message)
          closeModal()
        }
      } else {
        setError(data.error || "Failed to create appointment")
      }
    } catch (err) {
      setError("Failed to connect to database")
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeModal = () => {
    onOpenChange(false)
    setFormData({
      patient: "",
      date: "",
      time: "",
      duration: "60",
      procedure: "",
      dentist: "",
      room: "",
      notes: "",
      priority: "normal",
    })
    setSelectedPatientPhone("")
    setSendWhatsApp(true)
    setError("")
    setExistingAppointments([])
    setPatientSearch("")
    if (onAppointmentAdded) onAppointmentAdded()
  }

  const handleWhatsAppSend = async (message: string) => {
    try {
      await WhatsAppService.sendWhatsAppMessage({
        to: selectedPatientPhone,
        message,
        type: "appointment_scheduled",
      })
      alert("Appointment scheduled and WhatsApp message sent successfully!")
      closeModal()
    } catch {
      alert("Appointment scheduled but failed to send WhatsApp message.")
      closeModal()
    }
  }

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule New Appointment</DialogTitle>
            <DialogDescription>
              {prefilledDate
                ? `Create a new appointment for ${formatDateForDisplay(prefilledDate)}${prefilledTime ? ` at ${prefilledTime}` : ""}`
                : "Select date, time, and patient to create a new appointment."}
            </DialogDescription>
          </DialogHeader>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value, patient: "" })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="time">Time *</Label>
                <Select value={formData.time} onValueChange={(value) => setFormData({ ...formData, time: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {availableTimeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingAppointments && <p className="text-xs text-gray-500 mt-1">Checking availability...</p>}
                {formData.date && !loadingAppointments && (
                  <p className="text-xs text-gray-500 mt-1">{existingAppointments.length} slot(s) booked</p>
                )}
              </div>
            </div>

           <div>
  <Label htmlFor="patient">Patient *</Label>
  <Input
    type="text"
    placeholder="Search patient by name..."
    value={patientSearch}
    onChange={(e) => {
      setPatientSearch(e.target.value)
      setFormData({ ...formData, patient: "" }) // reset selection on search
    }}
    disabled={!formData.date} // require date first
  />

  {/* Dropdown appears only if user typed something */}
  {patientSearch.trim() !== "" && (
    <div className="max-h-48 overflow-y-auto border rounded p-2 mt-1 bg-white shadow-lg absolute z-50 w-full">
      {filteredPatients.length > 0 ? (
        filteredPatients.map((patient) => {
          const isSelected = formData.patient === patient.name
          return (
            <div
              key={patient.id}
              className={`p-2 rounded mb-1 cursor-pointer ${
                patient.hasAppointment
                  ? "bg-red-200 text-red-800 cursor-not-allowed"
                  : isSelected
                  ? "bg-green-200 text-green-900 cursor-default"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => {
                if (!patient.hasAppointment) handlePatientSelect(patient)
              }}
            >
              {patient.name} {patient.phone && `- ${patient.phone}`}
            </div>
          )
        })
      ) : (
        <p className="text-xs text-gray-500">No patients found</p>
      )}
    </div>
  )}
</div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="procedure">Procedure *</Label>
                <Select
                  value={formData.procedure}
                  onValueChange={(value) => setFormData({ ...formData, procedure: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select procedure" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedures.map((procedure) => (
                      <SelectItem key={procedure} value={procedure}>
                        {procedure}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dentist">Dentist *</Label>
                <Select
                  value={formData.dentist}
                  onValueChange={(value) => setFormData({ ...formData, dentist: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dentist" />
                  </SelectTrigger>
                  <SelectContent>
                    {dentists.map((dentist) => (
                      <SelectItem key={dentist} value={dentist}>
                        {dentist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg">
              <Checkbox
                id="sendWhatsApp"
                checked={sendWhatsApp}
                onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
              />
              <Label htmlFor="sendWhatsApp" className="text-sm font-medium">
                Send WhatsApp confirmation
              </Label>
              {selectedPatientPhone && <span className="text-xs text-gray-600">({selectedPatientPhone})</span>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Scheduling..." : "Schedule Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WhatsAppMessageModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        patientName={formData.patient}
        patientPhone={selectedPatientPhone}
        messageType="appointment_scheduled"
        prefilledMessage={whatsAppMessage}
        onSend={handleWhatsAppSend}
      />
    </>
  )
}

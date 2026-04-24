
// app/api/appointments/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"

// GET all appointments (filter by date or month)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const month = searchParams.get("month")

    const where: any = {}

    if (date) {
      const start = new Date(date)
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      where.date = { gte: start, lt: end }
    } else if (month) {
      const start = new Date(month + "-01")
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      where.date = { gte: start, lt: end }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        patient: true,
        doctor: true,
      },
    })

    return NextResponse.json({ success: true, appointments })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create new appointment
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Check if clinic is closed on this date
    const appointmentDate = new Date(data.date)
    const nextDay = new Date(data.date)
    nextDay.setDate(nextDay.getDate() + 1)

    const isHoliday = await prisma.clinicHoliday.findFirst({
      where: { date: { gte: appointmentDate, lt: nextDay } },
    })

    if (isHoliday) {
      return NextResponse.json(
        { success: false, error: `Clinic is closed on this day: ${isHoliday.reason || "Holiday"}` },
        { status: 400 }
      )
    }

    // Generate unique appointment ID
    const appointmentId = `APT${uuidv4().slice(0, 10)}`

    // Find patient by name if patientId not provided
    let patientId = data.patientId || null
    if (!patientId && data.patient) {
      const [firstName, ...rest] = data.patient.split(" ")
      const lastName = rest.join(" ")
      const patient = await prisma.patient.findFirst({
        where: { firstName, lastName },
      })
      if (patient) patientId = patient.id
    }

    const appointment = await prisma.appointment.create({
      data: {
        appointmentId,
        patientId,
        patientName: data.patient,
        doctorId: data.doctorId || null,
        doctorName: data.dentist || null,
        date: new Date(data.date),
        time: data.time || null,
        duration: parseInt(data.duration) || 60,
        room: data.room || null,
        procedureName: data.procedure || null,
        status: "pending",
        priority: data.priority || "normal",
        notes: data.notes || null,
      },
      include: { patient: true, doctor: true },
    })

    // Update patient's nextAppointment
    if (patientId) {
      await prisma.patient.update({
        where: { id: patientId },
        data: { nextAppointment: new Date(data.date) },
      })
    }

    return NextResponse.json(
      { success: true, appointment, message: "Appointment scheduled successfully!" },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
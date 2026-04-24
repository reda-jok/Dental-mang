// app/api/appointments/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one appointment with full details
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: Number(params.id) },
      include: {
        patient: true,
        doctor: true,
        procedures: {
          include: {
            procedureType: true,
            stockUsages: { include: { item: true } },
          },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, appointment })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update appointment
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()

    const appointment = await prisma.appointment.update({
      where: { id: Number(params.id) },
      data: {
        patientName: data.patient,
        doctorName: data.dentist || null,
        date: data.date ? new Date(data.date) : undefined,
        time: data.time || null,
        duration: data.duration ? parseInt(data.duration) : undefined,
        room: data.room || null,
        procedureName: data.procedure || null,
        status: data.status,
        priority: data.priority || "normal",
        notes: data.notes || null,
      },
      include: { patient: true, doctor: true },
    })

    // If completed → update patient's lastVisit
    if (data.status === "completed" && appointment.patientId) {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { lastVisit: new Date() },
      })
    }

    return NextResponse.json({ success: true, appointment })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PATCH update status only
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()

    const validStatuses = ["pending", "in-progress", "completed", "cancelled"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 })
    }

    const appointment = await prisma.appointment.update({
      where: { id: Number(params.id) },
      data: { status },
    })

    // If completed → update patient's lastVisit
    if (status === "completed" && appointment.patientId) {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { lastVisit: new Date() },
      })
    }

    return NextResponse.json({ success: true, appointment })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE one appointment
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.appointment.delete({
      where: { id: Number(params.id) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
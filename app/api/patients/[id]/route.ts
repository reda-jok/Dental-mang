// app/api/patients/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one patient with full history
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: Number(params.id) },
      include: {
        appointments: {
          orderBy: { date: "desc" },
          include: {
            procedures: {
              include: { procedureType: true }
            },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            items: true,
            payments: true,
          },
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ success: false, error: "Patient not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, patient })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update patient
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()

    const patient = await prisma.patient.update({
      where: { id: Number(params.id) },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        medicalHistory: data.medicalHistory || null,
        allergies: data.allergies || null,
        status: data.status,
      },
    })

    return NextResponse.json({ success: true, patient })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE patient (only if no invoices or appointments)
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)

    // Safety check — don't delete patient with history
    const appointmentCount = await prisma.appointment.count({ where: { patientId: id } })
    const invoiceCount = await prisma.invoice.count({ where: { patientId: id } })

    if (appointmentCount > 0 || invoiceCount > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete patient with existing appointments or invoices. Set status to Inactive instead." },
        { status: 400 }
      )
    }

    await prisma.patient.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
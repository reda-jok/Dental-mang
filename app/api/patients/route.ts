// app/api/patients/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all patients (optionally search by name or phone)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")

    const patients = await prisma.patient.findMany({
      where: search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { patientId: { contains: search, mode: "insensitive" } },
        ],
      } : {},
      orderBy: { createdAt: "desc" },
    })

    const mapped = patients.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      dateOfBirth: p.dateOfBirth,
      address: p.address,
      emergencyContactName: p.emergencyContactName,
      emergencyContactPhone: p.emergencyContactPhone,
      medicalHistory: p.medicalHistory,
      allergies: p.allergies,
      status: p.status,
      balance: p.balance,
      lastVisit: p.lastVisit ? new Date(p.lastVisit).toLocaleDateString() : "Never",
      nextAppointment: p.nextAppointment
        ? new Date(p.nextAppointment).toLocaleDateString()
        : "Not scheduled",
      createdAt: p.createdAt,
    }))

    return NextResponse.json({ success: true, patients: mapped })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create new patient
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Generate unique patient ID
    const count = await prisma.patient.count()
    const patientId = `P${String(count + 1).padStart(3, "0")}`

    const patient = await prisma.patient.create({
      data: {
        patientId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        address: data.address || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        medicalHistory: data.medicalHistory || null,
        allergies: data.allergies || null,
        status: "Active",
        balance: 0,
      },
    })

    return NextResponse.json(
      { success: true, patient, message: `Patient ${data.firstName} ${data.lastName} added successfully!` },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
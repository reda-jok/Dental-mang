// app/api/hr/employees/[id]/attendance/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET attendance history
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const attendance = await prisma.attendance.findMany({
      where: { employeeId: Number(params.id) },
      orderBy: { date: "desc" },
    })
    return NextResponse.json({ success: true, attendance })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST mark attendance for today
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const date = data.date ? new Date(data.date) : new Date()

    // Check if already marked
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: Number(params.id),
        date: {
          gte: new Date(date.toDateString()),
          lt: new Date(new Date(date.toDateString()).setDate(date.getDate() + 1)),
        },
      },
    })

    if (existing) {
      return NextResponse.json({ success: false, error: "Attendance already marked for this date" }, { status: 400 })
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: Number(params.id),
        date,
        status: data.status || "present", // present, absent
      },
    })

    return NextResponse.json({ success: true, attendance, message: "Attendance marked!" })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

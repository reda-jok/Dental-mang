// app/api/hr/leave-requests/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all leave requests
export async function GET() {
  try {
    const requests = await prisma.leaveRequest.findMany({
      orderBy: { startDate: "desc" },
      include: { employee: true },
    })
    return NextResponse.json({ success: true, requests })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create leave request
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: Number(data.employeeId),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || null,
        status: "pending",
      },
    })
    return NextResponse.json({ success: true, leaveRequest, message: "Leave request submitted!" }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

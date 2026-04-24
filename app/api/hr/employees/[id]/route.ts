// app/api/hr/employees/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one employee
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: Number(params.id) },
      include: {
        attendance: { orderBy: { date: "desc" }, take: 30 },
        payslips: { orderBy: [{ year: "desc" }, { month: "desc" }] },
        leaveRequests: { orderBy: { startDate: "desc" } },
      },
    })
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 })
    return NextResponse.json({ success: true, employee })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update employee
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const employee = await prisma.employee.update({
      where: { id: Number(params.id) },
      data: {
        fullName: data.fullName,
        phone: data.phone || null,
        email: data.email || null,
        role: data.role,
        salary: parseFloat(data.salary) || 0,
        isActive: data.isActive ?? true,
      },
    })
    return NextResponse.json({ success: true, employee })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

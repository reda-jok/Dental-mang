// app/api/hr/employees/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all employees
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      where: { isActive: true },
    })
    return NextResponse.json({ success: true, employees })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create employee
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const employee = await prisma.employee.create({
      data: {
        fullName: data.fullName,
        phone: data.phone || null,

        role: data.role,
        salary: parseFloat(data.salary) || 0,
        joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
        isActive: true,
      },
    })
    return NextResponse.json({ success: true, employee, message: `Employee "${data.fullName}" added successfully!` }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

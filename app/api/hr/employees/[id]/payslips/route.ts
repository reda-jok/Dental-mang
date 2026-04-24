// app/api/hr/employees/[id]/payslips/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all payslips for employee
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const payslips = await prisma.payslip.findMany({
      where: { employeeId: Number(params.id) },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })
    return NextResponse.json({ success: true, payslips })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST generate payslip for a month
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const employeeId = Number(params.id)

    // Check if payslip already exists for this month/year
    const existing = await prisma.payslip.findFirst({
      where: { employeeId, month: data.month, year: data.year },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: "Payslip already generated for this month" }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee) return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 })

    // Calculate commission from completed procedures this month
    const startOfMonth = new Date(data.year, data.month - 1, 1)
    const endOfMonth = new Date(data.year, data.month, 1)

    const procedures = await prisma.procedure.findMany({
      where: {
        appointment: {
          doctorId: employeeId,
          status: "completed",
          date: { gte: startOfMonth, lt: endOfMonth },
        },
      },
    })

    const commissionRate = parseFloat(data.commissionRate) || 0.1 // 10% default
    const commission = procedures.reduce((sum, p) => sum + p.price * commissionRate, 0)

    const allowances = parseFloat(data.allowances) || 0
    const deductions = parseFloat(data.deductions) || 0
    const netSalary = employee.salary + commission + allowances - deductions

    const payslip = await prisma.payslip.create({
      data: {
        employeeId,
        month: data.month,
        year: data.year,
        baseSalary: employee.salary,
        commission,
        allowances,
        deductions,
        netSalary,
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
      },
    })

    // Auto journal entry for payroll
    const salaryAccount = await prisma.account.findFirst({ where: { code: "SALARY_EXP" } })
    const cashAccount = await prisma.account.findFirst({ where: { code: "CASH" } })

    if (salaryAccount && cashAccount) {
      await prisma.journalEntry.create({
        data: {
          description: `Payslip for ${employee.fullName} - ${data.month}/${data.year}`,
          lines: {
            create: [
              { accountId: salaryAccount.id, debit: netSalary, credit: 0 },
              { accountId: cashAccount.id, debit: 0, credit: netSalary },
            ],
          },
        },
      })
    }

    return NextResponse.json({ success: true, payslip, message: "Payslip generated successfully!" }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

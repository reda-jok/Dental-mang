// app/api/accounting/reports/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET monthly financial summary
// Usage: /api/accounting/reports?month=2026-03
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7)

    const start = new Date(month + "-01")
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)

    // Total revenue (paid invoices this month)
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
    })
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)

    // Total payroll expenses this month
    const payslips = await prisma.payslip.findMany({
      where: {
        year: start.getFullYear(),
        month: start.getMonth() + 1,
      },
    })
    const totalPayroll = payslips.reduce((sum, p) => sum + p.netSalary, 0)

    // Unpaid invoices (outstanding balance)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["unpaid", "partial"] } },
    })
    const totalOutstanding = unpaidInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0
    )

    // New patients this month
    const newPatients = await prisma.patient.count({
      where: { createdAt: { gte: start, lt: end } },
    })

    // Completed appointments this month
    const completedAppointments = await prisma.appointment.count({
      where: { status: "completed", date: { gte: start, lt: end } },
    })

    return NextResponse.json({
      success: true,
      month,
      report: {
        totalRevenue,
        totalPayroll,
        netProfit: totalRevenue - totalPayroll,
        totalOutstanding,
        newPatients,
        completedAppointments,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

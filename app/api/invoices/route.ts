// app/api/invoices/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all invoices
export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { patient: true, items: true, payments: true },
    })
    return NextResponse.json({ success: true, invoices })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create invoice
export async function POST(request: Request) {
  try {
    const data = await request.json()

    const invoice = await prisma.invoice.create({
      data: {
        patientId: Number(data.patientId),
        totalAmount: parseFloat(data.totalAmount),
        paidAmount: 0,
        status: "unpaid",
        items: {
          create: data.items.map((item: any) => ({
            procedureId: Number(item.procedureId),
            description: item.description,
            amount: parseFloat(item.amount),
          })),
        },
      },
      include: { items: true, payments: true },
    })

    // Update patient balance
    await prisma.patient.update({
      where: { id: Number(data.patientId) },
      data: { balance: { increment: parseFloat(data.totalAmount) } },
    })

    return NextResponse.json({ success: true, invoice, message: "Invoice created successfully!" }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// app/api/invoices/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one invoice with items and payments
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(params.id) },
      include: { patient: true, items: true, payments: true },
    })
    if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update invoice status
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const invoice = await prisma.invoice.update({
      where: { id: Number(params.id) },
      data: { status: data.status },
    })
    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// app/api/invoices/[id]/payments/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all payments for an invoice
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const payments = await prisma.payment.findMany({
      where: { invoiceId: Number(params.id) },
      orderBy: { paidAt: "desc" },
    })
    return NextResponse.json({ success: true, payments })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST add payment to invoice
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const invoiceId = Number(params.id)

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: parseFloat(data.amount),
        method: data.method,
      },
    })

    // Update invoice paidAmount and status
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })

    const newPaidAmount = invoice.paidAmount + parseFloat(data.amount)
    const newStatus =
      newPaidAmount >= invoice.totalAmount ? "paid"
      : newPaidAmount > 0 ? "partial"
      : "unpaid"

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    })

    // Update patient balance
    await prisma.patient.update({
      where: { id: invoice.patientId },
      data: { balance: { decrement: parseFloat(data.amount) } },
    })

    // Auto journal entry for payment
    const cashAccount = await prisma.account.findFirst({ where: { code: "CASH" } })
    const revenueAccount = await prisma.account.findFirst({ where: { code: "REVENUE" } })

    if (cashAccount && revenueAccount) {
      await prisma.journalEntry.create({
        data: {
          description: `Payment of ${data.amount} for Invoice #${invoiceId}`,
          lines: {
            create: [
              { accountId: cashAccount.id, debit: parseFloat(data.amount), credit: 0 },
              { accountId: revenueAccount.id, debit: 0, credit: parseFloat(data.amount) },
            ],
          },
        },
      })
    }

    return NextResponse.json({ success: true, payment, invoice: updatedInvoice, message: "Payment added successfully!" })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

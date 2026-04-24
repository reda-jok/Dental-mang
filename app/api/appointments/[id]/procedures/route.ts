// app/api/appointments/[id]/procedures/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all procedures for an appointment
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const procedures = await prisma.procedure.findMany({
      where: { appointmentId: Number(params.id) },
      include: {
        procedureType: true,
        stockUsages: { include: { item: true } },
      },
    })

    return NextResponse.json({ success: true, procedures })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST add procedure to appointment
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const appointmentId = Number(params.id)

    const procedure = await prisma.procedure.create({
      data: {
        appointmentId,
        procedureTypeId: data.procedureTypeId ? Number(data.procedureTypeId) : null,
        name: data.name,
        toothNumber: data.toothNumber ? Number(data.toothNumber) : null,
        price: parseFloat(data.price),
        notes: data.notes || null,
      },
      include: { procedureType: true },
    })

    // Auto-deduct stock if materials are provided
    if (data.materials && Array.isArray(data.materials)) {
      for (const material of data.materials) {
        const itemId = Number(material.itemId)
        const quantity = parseFloat(material.quantity)

        // Create stock usage record
        await prisma.stockUsage.create({
          data: {
            procedureId: procedure.id,
            itemId,
            quantity,
          },
        })

        // Deduct from current stock
        await prisma.item.update({
          where: { id: itemId },
          data: { currentStock: { decrement: quantity } },
        })

        // Record stock movement
        await prisma.stockMovement.create({
          data: {
            itemId,
            type: "out",
            quantity,
            reason: `Used in procedure: ${data.name}`,
          },
        })
      }
    }

    return NextResponse.json(
      { success: true, procedure, message: "Procedure added successfully!" },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE a procedure
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { procedureId } = await request.json()

    await prisma.procedure.delete({
      where: { id: Number(procedureId) },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
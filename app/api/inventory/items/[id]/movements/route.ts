// app/api/inventory/items/[id]/movements/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET stock movement history
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: { itemId: Number(params.id) },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ success: true, movements })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST add stock movement (in / out / adjust)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const itemId = Number(params.id)
    const quantity = parseFloat(data.quantity)

    const movement = await prisma.stockMovement.create({
      data: {
        itemId,
        type: data.type,  // in, out, adjust
        quantity,
        reason: data.reason || null,
      },
    })

    // Update current stock
    const increment =
      data.type === "in" ? quantity
      : data.type === "out" ? -quantity
      : quantity - (await prisma.item.findUnique({ where: { id: itemId } }))!.currentStock

    await prisma.item.update({
      where: { id: itemId },
      data: { currentStock: { increment } },
    })

    return NextResponse.json({ success: true, movement, message: "Stock updated successfully!" })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

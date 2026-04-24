// app/api/inventory/items/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one item
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.item.findUnique({
      where: { id: Number(params.id) },
      include: { stockMovements: { orderBy: { createdAt: "desc" }, take: 20 } },
    })
    if (!item) return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT update item
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const item = await prisma.item.update({
      where: { id: Number(params.id) },
      data: {
        name: data.name,
        category: data.category || null,
        unit: data.unit || null,
        minStock: parseFloat(data.minStock) || 0,
      },
    })
    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE item
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.item.delete({ where: { id: Number(params.id) } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

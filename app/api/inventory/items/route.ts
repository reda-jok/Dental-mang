// app/api/inventory/items/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all items
export async function GET() {
  try {
    const items = await prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stockMovements: true } } },
    })
    return NextResponse.json({ success: true, items })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create item
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const item = await prisma.item.create({
      data: {
        name: data.name,
        category: data.category || null,
        unit: data.unit || null,
        currentStock: parseFloat(data.currentStock) || 0,
        minStock: parseFloat(data.minStock) || 0,
      },
    })
    return NextResponse.json({ success: true, item, message: `Item "${data.name}" added successfully!` }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

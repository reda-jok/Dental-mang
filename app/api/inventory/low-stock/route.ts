// app/api/inventory/low-stock/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET items below minimum stock
export async function GET() {
  try {
    const items = await prisma.item.findMany({
      where: {
        currentStock: { lte: prisma.item.fields.minStock },
      },
      orderBy: { currentStock: "asc" },
    })

    // Prisma doesn't support field comparison directly, use raw approach
    const allItems = await prisma.item.findMany()
    const lowStock = allItems.filter(item => item.currentStock <= item.minStock)

    return NextResponse.json({ success: true, items: lowStock })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

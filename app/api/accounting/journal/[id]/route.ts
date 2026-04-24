// app/api/accounting/journal/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET one journal entry with all lines
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: Number(params.id) },
      include: { lines: { include: { account: true } } },
    })
    if (!entry) return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 })
    return NextResponse.json({ success: true, entry })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

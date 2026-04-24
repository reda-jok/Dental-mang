// app/api/accounting/journal/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all journal entries
export async function GET() {
  try {
    const entries = await prisma.journalEntry.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        lines: { include: { account: true } },
      },
    })
    return NextResponse.json({ success: true, entries })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create manual journal entry
export async function POST(request: Request) {
  try {
    const data = await request.json()

    const entry = await prisma.journalEntry.create({
      data: {
        description: data.description,
        lines: {
          create: data.lines.map((line: any) => ({
            accountId: Number(line.accountId),
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    })

    return NextResponse.json({ success: true, entry, message: "Journal entry created!" }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

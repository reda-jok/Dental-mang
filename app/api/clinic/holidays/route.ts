// app/api/clinic/holidayes/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET all clinic holidays
export async function GET() {
  try {
    const holidays = await prisma.clinicHoliday.findMany({
      orderBy: { date: "asc" },
    })
    return NextResponse.json({ success: true, holidays })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST create new clinic holiday
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { date, reason } = data

    if (!date) {
      return NextResponse.json({ success: false, error: "Date is required" }, { status: 400 })
    }

    const holidayDate = new Date(date)

    // Check if holiday already exists on this date
    const existingHoliday = await prisma.clinicHoliday.findFirst({
      where: { date: holidayDate },
    })

    if (existingHoliday) {
      return NextResponse.json(
        { success: false, error: "A holiday already exists on this date" },
        { status: 400 }
      )
    }

    const newHoliday = await prisma.clinicHoliday.create({
      data: {
        date: holidayDate,
        reason,
      },
    })

    return NextResponse.json({ success: true, holiday: newHoliday })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}       


// DELETE a clinic holiday by date
export async function DELETE(request: Request) {
  try {
    const { date } = await request.json()

    if (!date) {
      return NextResponse.json({ success: false, error: "Holiday date    is required" }, { status: 400 })
    }

    const deletedHoliday = await prisma.clinicHoliday.deleteMany({
      where: { date:  new Date(date) },
    })

    return NextResponse.json({ success: true, holiday: deletedHoliday })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}   
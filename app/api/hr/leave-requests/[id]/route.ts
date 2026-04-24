// app/api/hr/leave-requests/[id]/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PUT approve or reject leave request
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ success: false, error: "Status must be approved or rejected" }, { status: 400 })
    }

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id: Number(params.id) },
      data: { status },
    })

    return NextResponse.json({ success: true, leaveRequest, message: `Leave request ${status}!` })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

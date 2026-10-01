import { z } from "zod"

import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import { errorResponse } from "@/server/http"
import { authorize } from "@/server/session"
import { openUpload } from "@/server/storage"

// Serves a patient attachment to users allowed to see clinical records.
export async function GET(_request: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  try {
    await authorize("clinical:read")
    const { id } = await ctx.params
    if (!z.uuid().safeParse(id).success) throw new AppError("not_found")

    const attachment = await db.attachment.findFirst({
      where: { id, deletedAt: null, patient: { deletedAt: null } },
      select: { storedName: true, mimeType: true, originalName: true },
    })
    if (!attachment) throw new AppError("not_found")

    const { size, stream } = await openUpload(attachment.storedName)
    return new Response(stream, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
        "X-Content-Type-Options": "nosniff",
        // The file itself may never run scripts or load anything.
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

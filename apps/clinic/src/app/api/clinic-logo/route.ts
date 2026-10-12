import { connection } from "next/server"

import { setClinicLogo } from "@/features/settings/service"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import { errorResponse, isSameOrigin } from "@/server/http"
import { authorize } from "@/server/session"
import { deleteUpload, detectFileType, openUpload, saveUpload } from "@/server/storage"

// The clinic's logo for printouts. Not secret (it's on every receipt), so reading it is
// public; changing it needs settings:write. Excluded from proxy.ts like /api/uploads.
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const

export async function GET() {
  await connection()
  const settings = await db.clinicSettings.findUnique({
    where: { id: 1 },
    select: { logoFile: true },
  })
  if (!settings?.logoFile) return new Response(null, { status: 404 })
  const { size, stream } = await openUpload(settings.logoFile)
  const ext = settings.logoFile.split(".").pop() as keyof typeof MIME
  return new Response(stream, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      // The address changes with the file (?v=…), so it can be cached for long.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new AppError("forbidden")
    const user = await authorize("settings:write")
    const declared = Number(request.headers.get("content-length") ?? 0)
    if (declared > MAX_LOGO_BYTES + 64 * 1024) throw new AppError("validation", "logoTooLarge")
    const file = (await request.formData()).get("file")
    if (!(file instanceof File) || file.size === 0) throw new AppError("validation", "fileRequired")
    if (file.size > MAX_LOGO_BYTES) throw new AppError("validation", "logoTooLarge")
    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = detectFileType(bytes)
    if (!type?.image) throw new AppError("validation", "imageRequired")

    const { storedName } = await saveUpload(bytes, type)
    let replaced: string | null
    try {
      replaced = await setClinicLogo(user, storedName)
    } catch (error) {
      await deleteUpload(storedName) // no orphan file when the DB write fails
      throw error
    }
    if (replaced) await deleteUpload(replaced)
    return Response.json({ ok: true, data: null }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new AppError("forbidden")
    const user = await authorize("settings:write")
    const replaced = await setClinicLogo(user, null)
    if (replaced) await deleteUpload(replaced)
    return Response.json({ ok: true, data: null })
  } catch (error) {
    return errorResponse(error)
  }
}

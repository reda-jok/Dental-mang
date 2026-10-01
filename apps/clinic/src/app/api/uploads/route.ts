import { uploadFieldsSchema } from "@/features/patients/attachments"
import { recordAudit } from "@/server/audit"
import { db } from "@/server/db"
import { AppError } from "@/server/errors"
import { errorResponse, isSameOrigin } from "@/server/http"
import { authorize } from "@/server/session"
import { deleteUpload, detectFileType, MAX_UPLOAD_BYTES, saveUpload } from "@/server/storage"

// Patient attachment upload (multipart). Excluded from proxy.ts so large bodies
// aren't buffered/truncated there; this handler does its own auth and CSRF checks.
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new AppError("forbidden")
    const user = await authorize("clinical:write")

    const declared = Number(request.headers.get("content-length") ?? 0)
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("validation", "fileTooLarge")

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) throw new AppError("validation", "fileRequired")
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("validation", "fileTooLarge")

    const fields = uploadFieldsSchema.parse({
      patientId: form.get("patientId"),
      kind: form.get("kind"),
      takenAt: form.get("takenAt") ?? undefined,
      notes: form.get("notes") ?? undefined,
    })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const type = detectFileType(bytes)
    if (!type) throw new AppError("validation", "fileTypeNotAllowed")
    if (fields.kind !== "document" && !type.image) throw new AppError("validation", "imageRequired")

    const patient = await db.patient.findFirst({
      where: { id: fields.patientId, deletedAt: null },
      select: { id: true },
    })
    if (!patient) throw new AppError("not_found")

    const { storedName, sha256 } = await saveUpload(bytes, type)
    try {
      const id = await db.$transaction(async (tx) => {
        const created = await tx.attachment.create({
          data: {
            patientId: fields.patientId,
            kind: fields.kind,
            originalName: file.name.slice(0, 200) || `file.${type.ext}`,
            storedName,
            mimeType: type.mime,
            sizeBytes: bytes.byteLength,
            sha256,
            takenAt: fields.takenAt,
            notes: fields.notes,
            uploadedById: user.id,
          },
          select: { id: true },
        })
        await recordAudit(tx, {
          userId: user.id,
          action: "create",
          entity: "attachment",
          entityId: created.id,
          after: {
            patientId: fields.patientId,
            kind: fields.kind,
            sizeBytes: bytes.byteLength,
            sha256,
          },
        })
        return created.id
      })
      return Response.json({ ok: true, data: { id } }, { status: 201 })
    } catch (error) {
      await deleteUpload(storedName) // no orphan files when the DB write fails
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
}

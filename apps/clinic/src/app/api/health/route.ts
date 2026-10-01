import { connection } from "next/server"

import { db } from "@/server/db"

// Liveness:  GET /api/health          → 200 if the app process is up.
// Readiness: GET /api/health?ready=1  → also checks the database (503 if down).
// Used by the appliance updater, Docker healthchecks and the e2e runner.
export async function GET(request: Request) {
  await connection()
  const ready = new URL(request.url).searchParams.has("ready")
  if (!ready) return Response.json({ status: "ok" })

  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: "ok", db: "ok" })
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 })
  }
}

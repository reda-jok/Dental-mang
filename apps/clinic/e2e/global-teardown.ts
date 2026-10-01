import { rm } from "node:fs/promises"

import { Client } from "pg"

import { ADMIN_DATABASE_URL, E2E_DB_NAME, E2E_UPLOAD_DIR } from "./database"

export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DB) return // keep it to debug a failure
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL })
  await admin.connect()
  // Only ever drops the database this run created.
  await admin.query(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`)
  await admin.end()
  await rm(E2E_UPLOAD_DIR, { recursive: true, force: true })
}

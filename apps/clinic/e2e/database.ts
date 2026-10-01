// Each e2e run gets its own throwaway database, created and dropped by the run itself.
// Nothing pre-existing is ever reset.

const ADMIN_URL =
  process.env.E2E_ADMIN_DATABASE_URL ?? "postgresql://dental:dental@localhost:5432/dental"

// Set once in the main process; workers and the web server inherit it.
process.env.E2E_DB_NAME ??= `dental_e2e_${Date.now()}`

export const E2E_DB_NAME = process.env.E2E_DB_NAME
export const ADMIN_DATABASE_URL = ADMIN_URL

export function e2eDatabaseUrl() {
  const url = new URL(ADMIN_URL)
  url.pathname = `/${E2E_DB_NAME}`
  url.searchParams.set("schema", "public")
  return url.toString()
}

/** Uploaded files for this run; removed with the database. */
export const E2E_UPLOAD_DIR = `./storage/e2e/${E2E_DB_NAME}`

import { execSync } from "node:child_process"

import { Client } from "pg"

import { ADMIN_DATABASE_URL, E2E_DB_NAME, e2eDatabaseUrl } from "./database"

export default async function globalSetup() {
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL })
  await admin.connect()
  await admin.query(`CREATE DATABASE "${E2E_DB_NAME}"`)
  await admin.end()

  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() },
  })
}

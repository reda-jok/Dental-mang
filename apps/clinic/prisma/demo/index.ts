// Builds the demo clinic in its own database (`dental_demo`), so development data is
// never touched. Run again to start over:
//   pnpm --filter clinic db:demo                    (600 patients)
//   pnpm --filter clinic db:demo -- --patients 1000
// Then: pnpm --filter clinic dev:demo  → http://localhost:3300 (users in prisma/demo/data.ts)
//
// Runs with the react-server condition so the app's server modules (billing services)
// can be used as they are.

import "dotenv/config"

import { execSync } from "node:child_process"

import { Client } from "pg"

import { demoDatabaseUrl, DEMO_DATABASE } from "./database"

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to build demo data in production.")
  }
  const flag = process.argv.indexOf("--patients")
  const patients = flag > 0 ? Number(process.argv[flag + 1]) : 600
  if (!Number.isInteger(patients) || patients < 1) throw new Error("--patients must be a number")

  const admin = new Client({ connectionString: process.env.DATABASE_URL })
  await admin.connect()
  // Only ever drops the demo database this script owns.
  await admin.query(`DROP DATABASE IF EXISTS "${DEMO_DATABASE}" WITH (FORCE)`)
  await admin.query(`CREATE DATABASE "${DEMO_DATABASE}"`)
  await admin.end()

  process.env.DATABASE_URL = demoDatabaseUrl()
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: process.env })

  // Imported after DATABASE_URL points at the demo database.
  const { seedDemo } = await import("./seed")
  const { db } = await import("@/server/db")
  try {
    await seedDemo({ patients })
  } finally {
    await db.$disconnect()
  }
  const { STAFF, PASSWORD } = await import("./data")
  console.log(`\nStart it with: pnpm --filter clinic dev:demo`)
  console.log(`Log in as ${STAFF.map((s) => `${s.username} (${s.role})`).join(", ")}`)
  console.log(`Password for every demo user: ${PASSWORD}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

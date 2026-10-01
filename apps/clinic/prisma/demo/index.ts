// Demo data for every feature, two ways:
//
//   pnpm --filter clinic db:demo        Rebuilds a separate database `dental_demo` from
//                                       scratch (600 patients). Run it again to start over.
//                                       Then: pnpm --filter clinic dev:demo → http://localhost:3300
//
//   pnpm --filter clinic db:seed        Adds the demo history INTO the development database
//                                       (DATABASE_URL): your settings, owner account and
//                                       patients are kept and used. Runs once per database.
//                                       Invoices, payments and journal entries can't be deleted
//                                       afterwards (only by recreating the database).
//
// Options: --patients 1000. Demo users and the shared password are in prisma/demo/data.ts.
// Runs with the react-server condition so the app's server modules (billing services)
// can be used as they are.

import "dotenv/config"

import { execSync } from "node:child_process"

import { Client } from "pg"

import { demoDatabaseUrl, DEMO_DATABASE } from "./database"

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to add demo data in production.")
  }
  const flag = process.argv.indexOf("--patients")
  const patients = flag > 0 ? Number(process.argv[flag + 1]) : 600
  if (!Number.isInteger(patients) || patients < 1) throw new Error("--patients must be a number")
  const into = process.argv.includes("--into-dev")

  if (!into) {
    const admin = new Client({ connectionString: process.env.DATABASE_URL })
    await admin.connect()
    // Only ever drops the demo database this script owns.
    await admin.query(`DROP DATABASE IF EXISTS "${DEMO_DATABASE}" WITH (FORCE)`)
    await admin.query(`CREATE DATABASE "${DEMO_DATABASE}"`)
    await admin.end()
    process.env.DATABASE_URL = demoDatabaseUrl()
  }
  // Brings the schema up to date (never drops anything).
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: process.env })

  // Imported after DATABASE_URL points at the right database.
  const { seedDemo } = await import("./seed")
  const { db } = await import("@/server/db")
  try {
    await seedDemo({ patients, mode: into ? "into" : "fresh" })
  } finally {
    await db.$disconnect()
  }
  const { STAFF, PASSWORD } = await import("./data")
  if (!into) console.log(`\nStart it with: pnpm --filter clinic dev:demo`)
  const users = STAFF.filter((s) => !into || s.role !== "owner")
  console.log(`Demo users: ${users.map((s) => `${s.username} (${s.role})`).join(", ")}`)
  console.log(`Password for every demo user: ${PASSWORD}`)
  if (into) console.log("The owner is your existing owner account.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"
import { env } from "@/server/env"

function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
}

// Reuse one client across hot reloads in development (avoids exhausting connections).
// After `prisma generate` the PrismaClient class is a new one, so a client cached from
// the old schema is replaced instead of reused (it wouldn't know the new models).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const cached = globalForPrisma.prisma
const isCurrent = cached instanceof PrismaClient
if (cached && !isCurrent) void (cached as PrismaClient).$disconnect().catch(() => {})

export const db = isCurrent ? cached : createClient()

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db

/** A client or an interactive-transaction client; services accept either. */
export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>

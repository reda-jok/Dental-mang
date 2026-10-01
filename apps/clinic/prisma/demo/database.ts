export const DEMO_DATABASE = "dental_demo"

/** DATABASE_URL with the database name swapped for the demo one. */
export function demoDatabaseUrl(base = process.env.DATABASE_URL) {
  if (!base) throw new Error("DATABASE_URL is not set (see .env.example)")
  const url = new URL(base)
  url.pathname = `/${DEMO_DATABASE}`
  return url.toString()
}

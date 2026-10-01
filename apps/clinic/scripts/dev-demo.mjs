// Runs the app against the demo database built by `pnpm db:demo`, on its own port and
// build folder so it can run next to the normal dev server.
//   pnpm --filter clinic dev:demo            → http://localhost:3300
import "dotenv/config"

import { spawn } from "node:child_process"

const url = new URL(process.env.DATABASE_URL)
url.pathname = "/dental_demo"
const port = process.env.PORT ?? "3300"

const child = spawn("pnpm", ["exec", "next", "dev", "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url.toString(),
    BETTER_AUTH_URL: `http://localhost:${port}`,
    NEXT_DIST_DIR: ".next-demo",
  },
})
child.on("exit", (code) => process.exit(code ?? 0))

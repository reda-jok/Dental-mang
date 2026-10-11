// Runs the app against the demo database built by `pnpm db:demo`, on its own port and
// build folder so it can run next to the normal dev server.
//   pnpm --filter clinic dev:demo            → http://localhost:3300 (dev mode: compiles each
//                                               page on first visit, so it feels slow)
//   pnpm --filter clinic start:demo          → the same, as a production build: builds once,
//                                               then runs as fast as a clinic install
import "dotenv/config"

import { spawn } from "node:child_process"
import { cpSync, existsSync } from "node:fs"
import path from "node:path"

const url = new URL(process.env.DATABASE_URL)
url.pathname = "/dental_demo"
const port = process.env.PORT ?? "3300"
const production = process.argv.includes("--prod")

const distDir = production ? ".next-demo-prod" : ".next-demo"
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  BETTER_AUTH_URL: `http://localhost:${port}`,
  NEXT_DIST_DIR: distDir,
  // Absolute: the standalone server runs from inside the build folder.
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads"),
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", env, ...options })
    child.on("exit", (code) => resolve(code ?? 0))
  })
}

if (!production) process.exit(await run("pnpm", ["exec", "next", "dev", "--port", port]))

// Production: build, then run the standalone server the clinic image uses. It serves
// the static files once they're copied next to it (Next's output: "standalone" docs).
const built = await run("pnpm", ["exec", "next", "build"])
if (built !== 0) process.exit(built)
const server = path.join(distDir, "standalone", "apps", "clinic")
cpSync(path.join(distDir, "static"), path.join(server, distDir, "static"), { recursive: true })
if (existsSync("public")) cpSync("public", path.join(server, "public"), { recursive: true })
process.exit(await run("node", ["server.js"], { cwd: server, env: { ...env, PORT: port } }))

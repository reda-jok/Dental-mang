// Fails if source files contain invisible or bidirectional-control characters.
// They can make code or text display differently from what it really is
// ("Trojan Source", CVE-2021-42574). Write them as \u escapes instead.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOTS = ["src", "e2e", "messages", "prisma"]
const SKIP = new Set(["generated", "node_modules"])
const EXTENSIONS = /\.(ts|tsx|mts|js|mjs|json|prisma|sql|css)$/
const FORBIDDEN = /[​-‏‪-‮⁠-⁩﻿]/u

let failures = 0
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.endsWith(".d.json.ts")) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (EXTENSIONS.test(name)) check(path)
  }
}
function check(path) {
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const match = line.match(FORBIDDEN)
      if (match) {
        const code = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
        console.error(`${path}:${i + 1}: invisible/bidi character U+${code}`)
        failures++
      }
    })
}

for (const root of ROOTS) {
  try {
    walk(root)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}
if (failures) {
  console.error(`\n${failures} line(s) contain invisible or bidi control characters.`)
  process.exit(1)
}

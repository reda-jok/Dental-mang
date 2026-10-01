import { adminClient, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, roles } from "@/lib/permissions"

// Same-origin: works at whatever address the clinic's devices use to reach the server.
export const authClient = createAuthClient({
  plugins: [usernameClient(), adminClient({ ac, roles })],
})

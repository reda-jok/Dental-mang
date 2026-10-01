import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // Generates types so a missing/misspelled translation key is a compile error.
    createMessagesDeclaration: "./messages/ar.json",
  },
})

const nextConfig: NextConfig = {
  // Self-contained server build for the clinic appliance's Docker image.
  output: "standalone",
  // Lets the e2e server run alongside `next dev` without sharing a build folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  // Static security headers. The Content-Security-Policy is set per request in proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ]
  },
  typedRoutes: true,
}

export default withNextIntl(nextConfig)

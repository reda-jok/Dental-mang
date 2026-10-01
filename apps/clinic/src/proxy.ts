import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PAGES = ["/login", "/setup"]

/**
 * Runs before every page and API request:
 * 1. Sets a strict, per-request Content-Security-Policy (nonce-based scripts).
 * 2. Optimistic auth redirect (cookie present?). Real authorization happens in
 *    the data layer on every request — never rely on this alone.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url))

  const isPublic =
    pathname.startsWith("/api/") ||
    PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))

  if (!isPublic && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = contentSecurityPolicy(nonce)

  // Next.js reads the nonce from this request header and applies it to its scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development"
  return [
    "default-src 'self'",
    // Only our own nonce-tagged scripts run; injected <script> tags are blocked.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // UI libraries (Radix, Sonner) set inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No upgrade-insecure-requests: the clinic LAN may run plain HTTP (decision D4).
  ].join("; ")
}

export const config = {
  matcher: [
    {
      // Everything except static files and the upload endpoint (it does its own auth and
      // must not have its body buffered here). Link prefetches don't need a CSP.
      source:
        "/((?!api/uploads|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}

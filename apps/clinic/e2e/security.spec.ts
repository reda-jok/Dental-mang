import { expect, test } from "@playwright/test"

import { login, loginAsOwner, OWNER, query } from "./fixtures"

test("pages send a nonce-based CSP and hardening headers", async ({ request }) => {
  const res = await request.get("/login")
  const headers = res.headers()
  expect(headers["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  )
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'")
  expect(headers["x-frame-options"]).toBe("DENY")
  expect(headers["x-content-type-options"]).toBe("nosniff")
  expect(headers["x-powered-by"]).toBeUndefined()
})

test("admin endpoints of the auth library are not reachable from the browser", async ({ page }) => {
  await loginAsOwner(page)
  const origin = new URL(page.url()).origin
  for (const path of [
    "/api/auth/admin/set-role",
    "/api/auth/admin/create-user",
    "/api/auth/update-user",
    "/api/auth/sign-up/email",
  ]) {
    // Layer 1: requests without our Origin are rejected as cross-site (CSRF protection).
    const crossSite = await page.request.post(path, { data: { userId: "x", role: "owner" } })
    expect(crossSite.status(), `${path} without Origin`).toBe(403)

    // Layer 2: even a same-origin, signed-in owner can't reach endpoints outside the allowlist.
    const sameSite = await page.request.post(path, {
      data: { userId: "x", role: "owner" },
      headers: { Origin: origin },
    })
    expect(sameSite.status(), path).toBe(404)
  }
})

test("sign-in attempts are written to the audit log", async ({ page }) => {
  await login(page, OWNER.username, "not-the-password")
  await expect(page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة.")).toBeVisible()

  const failed = await query<{ after: { username: string } }>(
    "select after from audit_log where action = 'login_failed' order by created_at desc limit 1",
  )
  expect(failed[0]?.after.username).toBe(OWNER.username)

  const logins = await query("select 1 from audit_log where action = 'login'")
  expect(logins.length).toBeGreaterThan(0)
})

test("text is cleaned of hidden characters before it is stored", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  await loginAsOwner(page)
  await page.goto("/settings/clinic")
  const address = page.getByLabel(/العنوان/)
  await address.fill("بغداد\u202E\u200B المنصور")
  await page.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم الحفظ")).toBeVisible()
  const [row] = await query<{ address: string }>("select address from clinic_settings where id = 1")
  expect(row?.address).toBe("بغداد المنصور")
})

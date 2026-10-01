import { expect, test } from "@playwright/test"

import { login, OWNER } from "./fixtures"

test("rejects a wrong password", async ({ page }) => {
  await login(page, OWNER.username, "wrong-password")
  await expect(page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة.")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test("owner logs in, sees the clinic and every module, then logs out", async ({
  page,
  isMobile,
}) => {
  await login(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: `أهلاً، ${OWNER.name}` })).toBeVisible()

  // The sidebar is a drawer on phones.
  if (isMobile) await page.getByRole("button", { name: "إظهار/إخفاء القائمة" }).click()

  const sidebar = page.locator("[data-sidebar=sidebar]").last()
  await expect(sidebar.getByText(OWNER.clinicName)).toBeVisible()
  await expect(sidebar.getByText("الحسابات")).toBeVisible() // owner-only area
  await expect(sidebar.getByText("المالك")).toBeVisible()

  await sidebar.getByText(OWNER.name).click()
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click()
  await expect(page).toHaveURL(/\/login$/)

  // Session is really gone.
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/login$/)
})

test("signing up through the auth API is disabled", async ({ request }) => {
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email: "x@example.com", password: "password-123", name: "x" },
  })
  expect(res.ok()).toBe(false)
})

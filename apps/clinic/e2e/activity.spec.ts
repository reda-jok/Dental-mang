import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, OWNER, RECEPTION, unique } from "./fixtures"

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label).click()
  await page.getByRole("option", { name: option }).click()
}

test("the owner sees who did what, and narrows it down", async ({ page }, testInfo) => {
  // Someone tries a username that doesn't exist.
  const intruder = unique("intruder", testInfo)
  await login(page, intruder, "wrong-password-1")
  await expect(page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة.")).toBeVisible()

  await loginAsOwner(page)
  await page.goto("/settings")
  await page.getByRole("link", { name: "سجل النشاط" }).click()
  await expect(page).toHaveURL(/\/settings\/activity$/)
  const rows = page.getByTestId("activity-row")
  await expect(
    rows.filter({ hasText: "تسجيل دخول" }).filter({ hasText: OWNER.name }).first(),
  ).toBeVisible()

  // Other tests write to the history meanwhile, so look among the sensitive entries.
  await choose(page, "النوع", "الإلغاء والحذف والدخول الفاشل")
  await expect(page).toHaveURL(/area=sensitive/)
  const failed = rows.filter({ hasText: intruder })
  await expect(failed).toContainText("محاولة دخول فاشلة")
  await expect(failed).toContainText("غير معروف")

  // Only the owner's own actions: the failed attempt had no one signed in.
  await choose(page, "الموظف", OWNER.name)
  await expect(page).toHaveURL(/person=/)
  await expect(failed).toHaveCount(0)

  await page.getByRole("button", { name: "مسح التصفية" }).click()
  await expect(page).toHaveURL(/\/settings\/activity$/)
  await choose(page, "النوع", "المال")
  await expect(page).toHaveURL(/area=money/)
  await expect(rows.filter({ hasText: "تسجيل دخول" })).toHaveCount(0)
})

test("staff without the permission don't see the history", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/settings/activity")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

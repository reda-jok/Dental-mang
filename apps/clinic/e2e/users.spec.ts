import { expect, test } from "@playwright/test"

import { login, loginAsOwner, logout, OWNER, unique } from "./fixtures"

test("owner manages a receptionist through their whole lifecycle", async ({ page }, testInfo) => {
  const username = unique("sara", testInfo)
  const name = `سارة ${testInfo.project.name}`
  const password = "blue-river-77"

  await loginAsOwner(page)
  await page.goto("/settings/users")

  // Create — with validation errors first.
  await page.getByRole("button", { name: "إضافة مستخدم" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("اسم المستخدم").fill("bad name")
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill("12345678")
  await dialog.getByLabel("تأكيد كلمة المرور").fill("12345678")
  await dialog.getByRole("button", { name: "إضافة مستخدم" }).click()
  await expect(dialog.getByText("أحرف إنجليزية صغيرة وأرقام و _ أو . فقط")).toBeVisible()
  await expect(dialog.getByText("كلمة المرور شائعة جداً وسهلة التخمين")).toBeVisible()

  await dialog.getByLabel("الاسم").fill(name)
  await dialog.getByLabel("اسم المستخدم").fill(username)
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill(password)
  await dialog.getByLabel("تأكيد كلمة المرور").fill(password)
  await dialog.getByRole("button", { name: "إضافة مستخدم" }).click()
  await expect(page.getByText("تمت إضافة المستخدم")).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: name })
  await expect(row).toContainText("استقبال")

  // The same username can't be created twice.
  await page.getByRole("button", { name: "إضافة مستخدم" }).click()
  await dialog.getByLabel("الاسم").fill("مكرر")
  await dialog.getByLabel("اسم المستخدم").fill(username)
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill(password)
  await dialog.getByLabel("تأكيد كلمة المرور").fill(password)
  await dialog.getByRole("button", { name: "إضافة مستخدم" }).click()
  await expect(dialog.getByText("اسم المستخدم هذا مستخدم مسبقاً").first()).toBeVisible()
  await page.keyboard.press("Escape")

  // The receptionist can log in but can't see or open settings.
  await logout(page)
  await login(page, username, password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText("الإعدادات")).toHaveCount(0)
  await page.goto("/settings/users")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()

  // Owner resets the password, then disables the account.
  await logout(page)
  await loginAsOwner(page)
  await page.goto("/settings/users")
  await row.getByRole("button", { name: "تعيين كلمة مرور جديدة" }).click()
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill("green-field-88")
  await dialog.getByLabel("تأكيد كلمة المرور").fill("green-field-88")
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم تغيير كلمة المرور")).toBeVisible()

  await row.getByRole("button", { name: "تعطيل الحساب ومنع الدخول" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "تعطيل الحساب" }).click()
  await expect(page.getByText("تم تعطيل الحساب")).toBeVisible()
  await expect(row).toContainText("معطّل")

  // Disabled: can't log in, even with the new password.
  await logout(page)
  await login(page, username, "green-field-88")
  await expect(page).toHaveURL(/\/login$/)

  // Re-enable, then the new password works.
  await loginAsOwner(page)
  await page.goto("/settings/users")
  await row.getByRole("button", { name: "إعادة تفعيل الحساب" }).click()
  await expect(page.getByText("تم تفعيل الحساب")).toBeVisible()
  await logout(page)
  await login(page, username, "green-field-88")
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("the owner can't disable themselves, and the tip says why", async ({ page, isMobile }) => {
  await loginAsOwner(page)
  await page.goto("/settings/users")
  const ownRow = page.getByRole("row").filter({ hasText: OWNER.name })
  const disable = ownRow.getByRole("button", { name: "تعطيل الحساب ومنع الدخول" })
  await expect(disable).toBeDisabled()
  if (!isMobile) {
    // Hovering before the page has hydrated does nothing; retry until the tip appears.
    await expect(async () => {
      await page.mouse.move(0, 0)
      await disable.locator("..").hover()
      await expect(page.getByRole("tooltip")).toContainText("لا يمكنك تعطيل حسابك بنفسك", {
        timeout: 1_000,
      })
    }).toPass()
  }
})

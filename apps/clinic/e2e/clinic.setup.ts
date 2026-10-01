import { expect, test } from "@playwright/test"

import { loginAsOwner, OWNER, RECEPTION } from "./fixtures"

test("first run: set up the clinic and owner account", async ({ page }) => {
  // No clinic yet → every route leads to setup.
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")

  // Client-side validation in Arabic.
  await page.getByRole("button", { name: "إنشاء العيادة" }).click()
  await expect(page.getByText("هذا الحقل مطلوب").first()).toBeVisible()

  await page.getByLabel("اسم العيادة").fill(OWNER.clinicName)
  await page.getByLabel("اسم المالك").fill(OWNER.name)
  await page.getByLabel("اسم المستخدم").fill(OWNER.username)
  await page.getByLabel("كلمة المرور", { exact: true }).fill(OWNER.password)
  await page.getByLabel("تأكيد كلمة المرور").fill("mismatch-123")
  await page.getByRole("button", { name: "إنشاء العيادة" }).click()
  await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible()

  await page.getByLabel("تأكيد كلمة المرور").fill(OWNER.password)
  await page.getByRole("button", { name: "إنشاء العيادة" }).click()
  await expect(page).toHaveURL(/\/login$/)

  // Setup can't be run a second time.
  await page.goto("/setup")
  await expect(page).toHaveURL(/\/login$/)
})

test("create a receptionist for permission tests", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/settings/users")
  await page.getByRole("button", { name: "إضافة مستخدم" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الاسم").fill(RECEPTION.name)
  await dialog.getByLabel("اسم المستخدم").fill(RECEPTION.username)
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill(RECEPTION.password)
  await dialog.getByLabel("تأكيد كلمة المرور").fill(RECEPTION.password)
  await dialog.getByRole("button", { name: "إضافة مستخدم" }).click()
  await expect(page.getByText("تمت إضافة المستخدم")).toBeVisible()
})

test("load the starter catalog and price two procedures", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/settings/procedures")
  await page.getByRole("button", { name: "تحميل القائمة الجاهزة" }).click()
  await expect(page.getByText("تمت إضافة القائمة الجاهزة")).toBeVisible()
  await expect(page.getByText("السعر غير محدد").first()).toBeVisible() // prices start unset

  const setPrice = async (name: string, price: string) => {
    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByRole("button", { name: "تعديل الإجراء والسعر" })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("السعر").fill(price)
    await dialog.getByRole("button", { name: "حفظ" }).click()
    await expect(page.getByText("تم تحديث الإجراء")).toBeVisible()
  }
  await setPrice("حشوة تجميلية", "٢٥,٠٠٠") // Arabic digits + thousands separator
  await setPrice("زرعة سنية", "1200000")

  await expect(page.getByRole("row", { name: /حشوة تجميلية/ })).toContainText("25,000")
  await expect(page.getByRole("row", { name: /زرعة سنية/ })).toContainText("1,200,000")
})

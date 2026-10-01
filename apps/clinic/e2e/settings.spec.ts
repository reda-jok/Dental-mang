import { expect, test } from "@playwright/test"

import { loginAsOwner, query } from "./fixtures"

test("owner edits clinic details with validation and phone normalization", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough: it changes shared clinic data")
  await loginAsOwner(page)
  await page.goto("/settings/clinic")

  const phone = page.getByLabel(/رقم الهاتف/)
  await phone.fill("123")
  await phone.blur()
  await expect(page.getByText("رقم هاتف عراقي غير صالح")).toBeVisible()

  // Arabic-Indic digits and spaces are accepted and stored in one format.
  await phone.fill("٠٧٧٠ ١٢٣ ٤٥٦٧")
  await page.getByLabel(/العنوان/).fill("  بغداد   - الكرادة  ")
  await page.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم الحفظ")).toBeVisible()

  const [row] = await query<{ phone: string; address: string }>(
    "select phone, address from clinic_settings where id = 1",
  )
  expect(row).toEqual({ phone: "+9647701234567", address: "بغداد - الكرادة" })

  const [audit] = await query<{ count: string }>(
    "select count(*) from audit_log where entity = 'clinic_settings' and action = 'update'",
  )
  expect(Number(audit?.count)).toBeGreaterThan(0)
})

test("the ⓘ hint explains a field on hover", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover")
  await loginAsOwner(page)
  await page.goto("/settings/clinic")
  const hint = page.getByRole("button", { name: "مزيد من المعلومات" }).first()
  // Hovering before the page has hydrated does nothing; retry until the tip appears.
  await expect(async () => {
    await page.mouse.move(0, 0)
    await hint.hover()
    await expect(page.getByRole("tooltip")).toContainText("بأي صيغة", { timeout: 1_000 })
  }).toPass()
})

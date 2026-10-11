import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, query, RECEPTION } from "./fixtures"

const panels = (page: Page) => page.locator("[data-wide]")

async function openCustomize(page: Page) {
  await page.getByRole("button", { name: "تخصيص اللوحة" }).click()
  return page.getByRole("dialog")
}

test("a user hides, reorders and resets their own dashboard", async ({ page }) => {
  await loginAsOwner(page)
  await expect(page.locator("[data-widget=calendar]")).toBeVisible()
  const firstBefore = await panels(page).first().getAttribute("data-widget")

  // Hide the calendar and move today's appointments to the top of the panels.
  let dialog = await openCustomize(page)
  await dialog.getByLabel("إظهار تقويم المواعيد").click()
  const up = dialog.getByRole("button", { name: "تحريك مواعيد اليوم للأعلى" })
  while (await up.isEnabled()) await up.click()
  await expect(dialog.locator("[data-group=wide] [data-widget-row]").first()).toHaveAttribute(
    "data-widget-row",
    "todayAppointments",
  )
  await dialog.getByRole("button", { name: "حفظ الترتيب" }).click()
  await expect(page.getByText("تم حفظ ترتيب لوحتك")).toBeVisible()
  await expect(page.locator("[data-widget=calendar]")).toHaveCount(0)
  await expect(panels(page).first()).toHaveAttribute("data-widget", "todayAppointments")

  // It survives a reload; reset brings the default back.
  await page.reload()
  await expect(page.locator("[data-widget=calendar]")).toHaveCount(0)
  dialog = await openCustomize(page)
  await dialog.getByRole("button", { name: "الرجوع للافتراضي" }).click()
  await expect(page.getByText("عادت لوحتك إلى الترتيب الافتراضي")).toBeVisible()
  await expect(page.locator("[data-widget=calendar]")).toBeVisible()
  await expect(panels(page).first()).toHaveAttribute("data-widget", firstBefore!)
})

test("the owner sets reception's default; reception never sees clinical widgets", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes a shared role default")
  await query("delete from dashboard_layout where role is not null")

  await loginAsOwner(page)
  const dialog = await openCustomize(page)
  await dialog.getByLabel("إظهار إجمالي المرضى").click() // hidden in the default
  await dialog.getByLabel("الترتيب الافتراضي لدور").click()
  await page.getByRole("option", { name: "استقبال" }).click()
  await dialog.getByRole("button", { name: "حفظ هذا الترتيب كافتراضي" }).click()
  await expect(page.getByText("تم حفظ الترتيب الافتراضي لدور استقبال")).toBeVisible()
  // The owner's own dashboard didn't change.
  await expect(page.locator("[data-widget=totalPatients]")).toBeVisible()

  await page.context().clearCookies()
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator("[data-widget=todayCount]")).toBeVisible()
  await expect(page.locator("[data-widget=totalPatients]")).toHaveCount(0)
  // Not allowed for reception, whatever the default says.
  await expect(page.locator("[data-widget=treatmentValue]")).toHaveCount(0)
  await expect(page.locator("[data-widget=openPlans]")).toHaveCount(0)
  await page.getByRole("button", { name: "تخصيص اللوحة" }).click()
  await expect(page.getByRole("dialog").getByText("قيمة العلاجات المنجزة")).toHaveCount(0)
  await expect(page.getByRole("dialog").getByText("الترتيب الافتراضي لدور")).toHaveCount(0)

  await query("delete from dashboard_layout where role is not null")
})

import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, newPatientWithPlan, RECEPTION } from "./fixtures"

const clinicToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date())
const daysAgo = (days: number) => {
  const d = new Date(`${clinicToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Runs a step from a case row: opens its dialog, fills it, confirms. */
async function step(
  page: Page,
  row: ReturnType<Page["locator"]>,
  name: RegExp,
  fill?: { reason?: string; date?: string },
) {
  await row.getByRole("button", { name }).click()
  const dialog = page.getByRole("dialog")
  if (fill?.date) await dialog.getByLabel(/تاريخ|موعد/).fill(fill.date)
  if (fill?.reason) await dialog.getByLabel(/سبب/).fill(fill.reason)
  await dialog.getByRole("button").filter({ hasNotText: /Close/ }).last().click()
  await expect(dialog).toBeHidden()
}

test("send work to a lab, chase it when late, and follow it to the fitting", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const labName = `مختبر الاختبار ${testInfo.project.name}`
  const name = `مريض مختبر ${testInfo.project.name}`
  await loginAsOwner(page)

  // A lab, with its usual turnaround.
  await page.goto("/lab/labs")
  await page.getByRole("button", { name: "إضافة مختبر" }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByLabel("اسم المختبر").fill(labName)
  await dialog.getByLabel(/مدة التسليم المعتادة/).fill("5")
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تمت إضافة المختبر")).toBeVisible()
  await expect(page.locator(`[data-lab='${labName}']`)).toContainText("التسليم خلال 5 يوم")

  // Send the implant crown from the patient's plan, ten days ago (so it's late now).
  const patientUrl = await newPatientWithPlan(page, name, desktop ? 151 : 152)
  await page.goto(`${patientUrl}/lab`)
  await page.getByRole("button", { name: "إرسال للمختبر" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel("من خطة العلاج").click()
  await page.getByRole("option", { name: /زرعة سنية/ }).click()
  await expect(dialog.getByLabel("العمل")).toHaveValue("زرعة سنية")
  await expect(dialog.getByLabel("الأسنان")).toHaveValue("36")
  await dialog.getByLabel("المختبر", { exact: true }).click()
  await page.getByRole("option", { name: labName }).click()
  await dialog.getByLabel("اللون").fill("A2")
  await dialog.getByLabel("المادة").click()
  await page.getByRole("option", { name: "زيركون" }).click()
  await dialog.getByLabel("تاريخ الإرسال").fill(daysAgo(10))
  await dialog.getByLabel("موعد التسليم").fill(daysAgo(3))
  await dialog.getByLabel(/كلفة المختبر/).fill("90,000")
  await dialog.getByRole("button", { name: "إرسال للمختبر" }).click()
  await expect(page.getByText("تم تسجيل الحالة")).toBeVisible()
  const row = page.locator("[data-lab-case]").first()
  await expect(row).toContainText("في المختبر")
  await expect(row).toContainText("متأخر منذ")

  // The dashboard warns about it.
  await page.goto("/dashboard")
  await expect(page.getByTestId("lab-alerts")).toContainText(name)

  // Back from the lab → sent back to be redone → back again → fitted.
  await page.goto(`${patientUrl}/lab`)
  await step(page, row, /^استلام .* من المختبر$/)
  await expect(row).toContainText("بانتظار التركيب")
  await step(page, row, /^إعادة .* للمختبر$/, { reason: "اللون غير مطابق" })
  await expect(row).toContainText("في المختبر")
  await expect(row).toContainText("أُعيد مرة")
  await step(page, row, /^استلام .* من المختبر$/)
  await step(page, row, /^تركيب .* للمريض$/)
  await expect(row).toContainText("مركّب")
  await expect(row.getByRole("button")).toHaveCount(0) // nothing left to do

  // A second case, not from the plan, cancelled.
  await page.getByRole("button", { name: "إرسال للمختبر" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel("العمل").fill("طقم كامل")
  await dialog.getByLabel("المختبر", { exact: true }).click()
  await page.getByRole("option", { name: labName }).click()
  await dialog.getByRole("button", { name: "إرسال للمختبر" }).click()
  await expect(page.locator("[data-lab-case]")).toHaveCount(2)
  const second = page.locator("[data-lab-case]").filter({ hasText: "طقم كامل" })
  await step(page, second, /^إلغاء الحالة/, { reason: "المريض أجّل العلاج" })
  await expect(second).toContainText("ملغى")
  await expect(second).toContainText("المريض أجّل العلاج")

  // On the lab page, found by patient name among fitted work.
  await page.goto(`/lab?status=fitted&q=${encodeURIComponent(name)}`)
  await expect(page.locator("[data-lab-case]")).toHaveCount(1)
})

test("reception sees lab work but can't change it", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/lab?status=all")
  await expect(page.getByText("الحالات")).toBeVisible()
  await expect(page.locator("[data-lab-case]").first().getByRole("button")).toHaveCount(0)
  await page.goto("/lab/labs")
  await expect(page.getByRole("button", { name: "إضافة مختبر" })).toHaveCount(0)
})

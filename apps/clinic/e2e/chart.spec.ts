import { expect, test, type Page } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  logout,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

const tooth = (page: Page, n: number) => page.locator(`[data-tooth="${n}"]`)
const surfaceChip = (page: Page, s: string) => page.locator(`[data-surface-chip="${s}"]`)

async function pickProcedure(page: Page, name: RegExp) {
  await page.getByLabel("الإجراء", { exact: true }).click()
  await page.getByRole("option", { name }).click()
}

test("chart → plan → done: caries becomes a filling and the plan completes", async ({
  page,
}, testInfo) => {
  const seed = testInfo.project.name === "desktop" ? 51 : 52
  await loginAsOwner(page)
  await createPatient(page, `مريض المخطط ${testInfo.project.name}`, uniquePhone(seed))
  await expectCreated(page)
  const patientUrl = page.url()
  await page.goto(`${patientUrl}/chart`)

  // The chart is never mirrored by RTL: patient's right on the viewer's left.
  const box18 = await page.locator('[data-tooth="18"]').boundingBox()
  const box28 = await page.locator('[data-tooth="28"]').boundingBox()
  expect(box18!.x).toBeLessThan(box28!.x)

  // Record caries on 16, surfaces O + M.
  await tooth(page, 16).click()
  await surfaceChip(page, "O").click()
  await surfaceChip(page, "M").click()
  await page.getByRole("button", { name: "تسجيل", exact: true }).click()
  await expect(page.getByText("تم تسجيل الحالة")).toBeVisible()
  await expect(tooth(page, 16)).toHaveAttribute("data-condition", "caries")
  await expect(tooth(page, 16)).toContainText("MO") // the affected surfaces show on the tile
  await expect(tooth(page, 17)).toHaveAttribute("data-condition", "healthy")

  // A surface procedure without surfaces is refused.
  await tooth(page, 16).click()
  await pickProcedure(page, /حشوة تجميلية/)
  await page.getByRole("button", { name: "إضافة إلى الخطة" }).click()
  await expect(page.getByText("هذا الإجراء يحتاج تحديد أسطح السن")).toBeVisible()

  // Plan the filling on the carious surfaces (new plan).
  await surfaceChip(page, "O").click()
  await surfaceChip(page, "M").click()
  await page.getByRole("button", { name: "إضافة إلى الخطة" }).click()
  await expect(page.getByText("تمت إضافة علاج واحد")).toBeVisible()

  // Implant on 36, priced in USD.
  await tooth(page, 36).click()
  await pickProcedure(page, /زرعة سنية/)
  await page.getByRole("button", { name: "إضافة إلى الخطة" }).click()
  await expect(page.getByText("تمت إضافة علاج واحد")).toBeVisible()

  // Plans tab: both items, separate totals per currency.
  await page.goto(`${patientUrl}/plans`)
  const plan = page.locator("[data-plan]").first()
  await expect(plan).toContainText("مقترحة")
  await expect(plan.getByRole("row", { name: /حشوة تجميلية/ })).toContainText("MO")
  await expect(plan).toContainText("25,000")
  await expect(plan).toContainText("900.00")

  // Done: the filling replaces the caries on the chart.
  await plan.getByRole("combobox", { name: /حشوة تجميلية/ }).click()
  await page.getByRole("option", { name: "منجز" }).click()
  await expect(page.getByText("تم تحديث الحالة").first()).toBeVisible()
  await page.goto(`${patientUrl}/chart`)
  await expect(tooth(page, 16)).toHaveAttribute("data-condition", "filling")

  // Finishing the last item completes the plan automatically.
  await page.goto(`${patientUrl}/plans`)
  await plan.getByRole("combobox", { name: /زرعة سنية/ }).click()
  await page.getByRole("option", { name: "منجز" }).click()
  await expect(plan).toContainText("مكتملة")
  await page.goto(`${patientUrl}/chart`)
  await expect(tooth(page, 36)).toHaveAttribute("data-condition", "implant")

  // Everything is in the audit log.
  const patientId = patientUrl.split("/").pop()
  const [audit] = await query<{ count: string }>(
    "select count(*) from audit_log where entity in ('tooth_finding','treatment_plan','treatment_plan_item') and (entity_id = $1 or entity_id in (select id::text from treatment_plan where patient_id = $1::uuid) or entity_id in (select i.id::text from treatment_plan_item i join treatment_plan p on p.id = i.plan_id where p.patient_id = $1::uuid))",
    [patientId],
  )
  expect(Number(audit?.count)).toBeGreaterThanOrEqual(6)
})

test("reception can't open the chart or plans", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  const [patient] = await query<{ id: string }>(
    "select id from patient where deleted_at is null limit 1",
  )
  for (const tab of ["chart", "plans"]) {
    await page.goto(`/patients/${patient!.id}/${tab}`)
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
  }
  await logout(page)
})

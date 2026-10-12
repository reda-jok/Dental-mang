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

  // Record caries on 16, surfaces O + M: choose the condition, then tap the surfaces.
  await page.locator('[data-tool="caries"]').click()
  await tooth(page, 16).locator('[data-surface="O"]').click()
  await expect(page.getByText("تم تسجيل تسوس على السن 16").first()).toBeVisible()
  await tooth(page, 16).locator('[data-surface="M"]').click()
  await expect(tooth(page, 16).locator('[data-surface="M"]')).toHaveAttribute(
    "data-color",
    "#dc2626",
  )
  await expect(tooth(page, 16)).toHaveAttribute("data-condition", "caries")
  await expect(tooth(page, 16)).toHaveAttribute("data-problem", "true")
  await expect(tooth(page, 16).locator('[data-surface="O"]')).toHaveAttribute(
    "data-color",
    "#dc2626",
  )
  await expect(tooth(page, 16).locator('[data-surface="D"]')).not.toHaveAttribute("data-color")
  await expect(tooth(page, 17)).toHaveAttribute("data-condition", "healthy")
  await expect(page.getByTestId("needs-treatment")).toContainText("تسوس")

  // A mistake is undone from the confirmation.
  await tooth(page, 26).locator('[data-surface="O"]').click()
  await expect(tooth(page, 26)).toHaveAttribute("data-condition", "caries")
  await page.getByRole("button", { name: "تراجع" }).first().click()
  await expect(tooth(page, 26)).toHaveAttribute("data-condition", "healthy")

  // With nothing chosen, tapping a tooth shows what's on it.
  await page.locator('[data-tool="view"]').click()
  await tooth(page, 16).click()
  await expect(page.getByTestId("tooth-popover")).toContainText("تسوس")
  await page.keyboard.press("Escape")

  // Plan the filling: tapping the tooth offers the carious surfaces (new plan).
  await page.locator('[data-tool="treatment"]').click()
  await pickProcedure(page, /حشوة تجميلية/)
  // The number, not a surface: the tooth as a whole.
  await tooth(page, 16).getByText("16", { exact: true }).click()
  const popover = page.getByTestId("tooth-popover")
  await expect(surfaceChip(page, "M")).toHaveAttribute("aria-pressed", "true")
  await expect(surfaceChip(page, "O")).toHaveAttribute("aria-pressed", "true")
  await expect(surfaceChip(page, "D")).toHaveAttribute("aria-pressed", "false")
  await popover.getByRole("button", { name: "إضافة إلى الخطة" }).click()
  await expect(page.getByText(/أُضيف حشوة تجميلية.* على السن 16 إلى الخطة/)).toBeVisible()

  // Implant on 36: one tap.
  await pickProcedure(page, /زرعة سنية/)
  await tooth(page, 36).click()
  await expect(page.getByText(/أُضيف زرعة سنية.* على السن 36 إلى الخطة/)).toBeVisible()

  // Plans tab: the phase as a step, both treatments, the totals and the progress.
  await page.goto(`${patientUrl}/plans`)
  const plan = page.locator("[data-plan]").filter({ visible: true }).first()
  await expect(plan).toContainText("مقترحة")
  await expect(plan.locator("[data-item^='حشوة تجميلية']")).toContainText("MO")
  await expect(plan).toContainText("25,000")
  await expect(plan).toContainText("1,200,000")
  await expect(plan).toContainText("1,225,000")
  await expect(plan.getByTestId("plan-progress")).toContainText("0 من 2")
  // The plan's teeth on the small chart, with their phase.
  await expect(plan.getByTestId("plan-mini-chart").locator("[data-phase]")).toHaveCount(2)
  // No visit booked yet: the plans say so, with the booking button.
  await expect(page.getByTestId("next-visit")).toContainText("لا يوجد موعد قادم")

  // Done with one tap: the filling replaces the caries on the chart.
  await plan.getByRole("button", { name: /تم: حشوة تجميلية/ }).click()
  await expect(page.getByText("تم تسجيل العلاج كمنجز").first()).toBeVisible()
  await expect(plan.getByTestId("plan-progress")).toContainText("1 من 2")
  await page.goto(`${patientUrl}/chart`)
  await expect(tooth(page, 16)).toHaveAttribute("data-condition", "filling")

  // Finishing the last item completes the plan automatically.
  await page.goto(`${patientUrl}/plans`)
  await plan.getByRole("button", { name: /تم: زرعة سنية/ }).click()
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

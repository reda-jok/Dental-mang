import { test, type Page } from "@playwright/test"

import { loginAsOwner, logout, query } from "./fixtures"

// Screenshots of every screen for design review. Runs only when asked:
//   VISUAL_TOUR_DIR=/tmp/tour pnpm --filter clinic test:e2e e2e/visual-tour.spec.ts
// (after the other specs, so the clinic has patients, plans and files to show).
const dir = process.env.VISUAL_TOUR_DIR

test.skip(!dir, "set VISUAL_TOUR_DIR to take screenshots")

test("visual tour", async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  let n = 0
  const shot = async (name: string) => {
    await page.waitForLoadState("networkidle")
    await page.screenshot({
      path: `${dir}/${testInfo.project.name}-${String(++n).padStart(2, "0")}-${name}.png`,
      fullPage: true,
    })
  }
  const patientUrl = async (namePart: string) => {
    const [row] = await query<{ id: string }>(
      "select id from patient where full_name like $1 and deleted_at is null order by created_at limit 1",
      [`%${namePart}%`],
    )
    return row ? `/patients/${row.id}` : null
  }
  const visit = async (page: Page, url: string | null, name: string) => {
    if (!url) return
    await page.goto(url)
    await shot(name)
  }

  await logout(page)
  await page.goto("/login")
  await shot("login")

  await loginAsOwner(page)
  await shot("dashboard")
  await visit(page, "/patients", "patients")
  await visit(page, "/patients/new", "patient-new")

  const charted = await patientUrl("مريض المخطط")
  await visit(page, charted, "patient-overview")
  await visit(page, charted && `${charted}/chart`, "patient-chart")
  await visit(page, charted && `${charted}/plans`, "patient-plans")
  await visit(page, charted && `${charted}/medical`, "patient-medical")
  const xrays = await patientUrl("مريض أشعة")
  await visit(page, xrays && `${xrays}/files`, "patient-files")
  const allergic = await patientUrl("مريض استقبال")
  await visit(page, allergic, "patient-alert")

  const [appt] = await query<{ day: string }>(
    "select to_char(starts_at at time zone 'Asia/Baghdad', 'YYYY-MM-DD') as day from appointment order by starts_at limit 1",
  )
  if (appt) {
    await visit(page, `/dashboard?cal=${appt.day}&view=month`, "dashboard-calendar")
    await visit(page, `/appointments?date=${appt.day}`, "appointments-day")
    await page
      .locator(`[data-day]`)
      .first()
      .waitFor({ state: "detached" })
      .catch(() => {})
    await page.goto(`/dashboard?cal=${appt.day}&view=month`)
    await page.locator(`[data-day="${appt.day}"]`).click()
    await shot("calendar-day-popup")
    await page.keyboard.press("Escape")
  }
  await page.getByRole("button", { name: "موعد جديد" }).click()
  await shot("booking-dialog")
  await page.keyboard.press("Escape")

  await visit(page, "/billing", "billing")
  const [invoice] = await query<{ id: string }>(
    "select id from invoice where status = 'issued' order by created_at limit 1",
  )
  await visit(page, invoice ? `/billing/${invoice.id}` : null, "invoice")
  const billed = await patientUrl("مريض فاتورة")
  await visit(page, billed && `${billed}/billing`, "patient-billing")
  if (billed) {
    await page.getByRole("button", { name: "فاتورة جديدة" }).click()
    await shot("new-invoice")
    await page.keyboard.press("Escape")
  }

  const paying = await patientUrl("مريض دفعات")
  await visit(page, paying && `${paying}/billing`, "patient-payments")
  if (paying) {
    await page.getByRole("button", { name: "تسجيل دفعة" }).click()
    await shot("payment-dialog")
    await page.keyboard.press("Escape")
  }

  await visit(page, "/billing/debts", "debts")
  await visit(page, "/billing/cash", "cash")
  const [printable] = await query<{ payment: string; plan: string }>(
    "select (select id from payment order by created_at limit 1) as payment, (select id from treatment_plan order by created_at limit 1) as plan",
  )
  if (printable?.payment) await visit(page, `/print/receipt/${printable.payment}`, "print-receipt")
  if (printable?.plan) await visit(page, `/print/quote/${printable.plan}`, "print-quote")
  const [prescription] = await query<{ id: string }>("select id from prescription limit 1")
  if (prescription)
    await visit(page, `/print/prescription/${prescription.id}`, "print-prescription")
  await visit(page, "/settings/medications", "settings-medications")

  await visit(page, "/lab?status=all", "lab")
  await visit(page, "/lab/labs", "labs")
  const labPatient = await patientUrl("مريض مختبر")
  await visit(page, labPatient && `${labPatient}/lab`, "patient-lab")

  await visit(page, "/settings/schedule", "settings-schedule")
  await visit(page, "/settings/clinic", "settings-clinic")
  await visit(page, "/settings/procedures", "settings-procedures")
  await visit(page, "/settings/users", "settings-users")
  await visit(page, "/settings/permissions", "settings-permissions")
  await page.goto("/settings/procedures")
  await page.getByRole("button", { name: "تعديل الإجراء والسعر" }).first().click()
  await shot("procedure-dialog")
})

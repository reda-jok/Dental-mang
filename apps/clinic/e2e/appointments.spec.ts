import { expect, test, type Page } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  logout,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

/** Clinic-local date `offset` days from today, skipping Fridays (weekly day off). */
function clinicDate(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date())
  const d = new Date(`${today}T00:00:00Z`)
  let added = 0
  while (added < offset) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 5) added++
  }
  return d.toISOString().slice(0, 10)
}

function nextFriday(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date())
  const d = new Date(`${today}T00:00:00Z`)
  do d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 5)
  return d.toISOString().slice(0, 10)
}

async function pickTime(page: Page, label: string) {
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("الوقت")).toBeEnabled()
  await dialog.getByLabel("الوقت").click()
  await page.getByRole("option", { name: label, exact: true }).click()
}

test("book a visit, confirm on WhatsApp, run it, and see it on the calendar", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 2 : 3)
  const name = `مريض موعد ${testInfo.project.name}`

  await loginAsOwner(page)
  await createPatient(page, name, uniquePhone(desktop ? 71 : 72))
  await expectCreated(page)
  const patientUrl = page.url()

  // Book from the patient page: the patient is already filled in.
  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(name)).toBeVisible()
  await dialog.getByLabel("التاريخ").fill(date)
  await pickTime(page, "4:00 م")
  await expect(dialog.getByText("لا توجد حجوزات في هذا اليوم")).toBeVisible()
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()

  // WhatsApp confirmation, in Arabic, with the time the Iraqi way.
  const wa = page.getByRole("dialog", { name: /رسالة واتساب/ })
  await expect(wa).toBeVisible()
  await expect(wa.getByLabel("نص الرسالة")).toHaveValue(/تأكيد الموعد[\s\S]*4:00/)
  await wa.getByRole("button", { name: "تخطي" }).click()

  // Patient's appointments tab.
  await page.goto(`${patientUrl}/appointments`)
  const card = page.locator("article[data-appointment]").first()
  await expect(card).toContainText("4:00 م")
  await expect(card).toContainText("بانتظار")

  // Scheduler: run the visit.
  await page.goto(`/appointments?date=${date}`)
  const visit = page.locator("article[data-appointment]", { hasText: name })
  await visit.getByRole("button", { name: "بدء" }).click()
  await expect(visit).toContainText("قيد التنفيذ")
  await visit.getByRole("button", { name: "إنهاء" }).click()
  await expect(visit).toContainText("مكتمل")
  // The "treatment completed" message is offered right away.
  await expect(page.getByRole("dialog", { name: /رسالة واتساب/ })).toContainText("اكتمال العلاج")
  await page.getByRole("button", { name: "تخطي" }).click()
  // Next step after a completed visit: book the follow-up.
  await expect(visit.getByRole("button", { name: "حجز الموعد القادم" })).toBeVisible()

  // Dashboard calendar shows it on that day.
  await page.goto(`/dashboard?cal=${date}&view=week`)
  await expect(page.locator(`[data-day="${date}"]`)).toContainText(name)
})

test("a booked time and an already-booked patient can't be picked again", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 4 : 5)
  const first = `مريض أول ${testInfo.project.name}`
  const second = `مريض ثان ${testInfo.project.name}`

  await loginAsOwner(page)
  await createPatient(page, second, uniquePhone(desktop ? 81 : 82))
  await expectCreated(page)
  await createPatient(page, first, uniquePhone(desktop ? 83 : 84))
  await expectCreated(page)

  await page.getByRole("button", { name: "حجز موعد" }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(date)
  await pickTime(page, "5:00 م")
  await page.getByRole("dialog").getByLabel("إرسال تأكيد عبر واتساب").uncheck()
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()

  // Header → new appointment, same day.
  await page.getByRole("button", { name: "موعد جديد" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(date)
  await expect(dialog.getByText("وقت واحد محجوز")).toBeVisible()
  await dialog.getByLabel("الوقت").click()
  await expect(page.getByRole("option", { name: /5:00 م/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
  await page.keyboard.press("Escape")

  // The first patient is already booked that day: red and not selectable.
  await dialog.getByPlaceholder("ابحث عن المريض بالاسم أو الهاتف…").fill(first)
  const option = dialog.getByRole("option", { name: new RegExp(first) })
  await expect(option).toContainText("لديه موعد في هذا اليوم")
  await expect(option).toBeDisabled()

  // The second patient is free.
  await dialog.getByPlaceholder("ابحث عن المريض بالاسم أو الهاتف…").fill(second)
  await expect(dialog.getByRole("option", { name: new RegExp(second) })).toBeEnabled()
})

test("rest days: Fridays and closed days can't be booked", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes shared clinic days")
  const closedDay = clinicDate(6)

  await loginAsOwner(page)

  // Fridays are closed by default.
  await page.getByRole("button", { name: "موعد جديد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(nextFriday())
  await expect(dialog.getByText("العيادة مغلقة في هذا اليوم.")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "حجز الموعد" })).toBeDisabled()
  await page.keyboard.press("Escape")

  // Close a day from the calendar's day popup.
  await page.goto(`/dashboard?cal=${closedDay}&view=week`)
  await page.locator(`[data-day="${closedDay}"]`).click()
  await page.getByRole("dialog").getByRole("switch").click()
  await expect(page.getByText("تم تحويل اليوم إلى يوم راحة")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(`[data-day="${closedDay}"]`)).toContainText("يوم راحة")

  // Booking that day is refused.
  await page.getByRole("button", { name: "موعد جديد" }).click()
  await page.getByRole("dialog").getByLabel("التاريخ").fill(closedDay)
  await expect(page.getByRole("dialog").getByText("العيادة مغلقة في هذا اليوم.")).toBeVisible()
  await page.keyboard.press("Escape")

  // Reopen it.
  await page.locator(`[data-day="${closedDay}"]`).click()
  await page.getByRole("dialog").getByRole("switch").click()
  await expect(page.getByText("تم فتح اليوم للحجز")).toBeVisible()
})

test("reception books appointments but can't close days", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("button", { name: "موعد جديد" })).toBeEnabled()
  await page.locator(`[data-day="${clinicDate(1)}"]`).click()
  await expect(page.getByRole("dialog").getByRole("switch")).toBeDisabled()
  await logout(page)
})

test("rooms added in settings appear in the booking form", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes shared settings")
  await loginAsOwner(page)
  await page.goto("/settings/schedule")
  await page.getByLabel("اسم الغرفة").fill("الكرسي 1")
  await page.getByRole("button", { name: "إضافة غرفة" }).click()
  await expect(page.getByText("تمت إضافة الغرفة")).toBeVisible()

  await page.getByRole("button", { name: "موعد جديد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الغرفة").click()
  await expect(page.getByRole("option", { name: "الكرسي 1" })).toBeVisible()
})

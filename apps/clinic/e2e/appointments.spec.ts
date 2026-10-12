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

function clinicToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date())
}

function nextFriday(): string {
  const d = new Date(`${clinicToday()}T00:00:00Z`)
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

/** A visit not in a plan needs a reason. */
async function pickReason(page: Page, reason: string) {
  await page.getByRole("dialog").getByLabel("سبب الزيارة").click()
  await page.getByRole("option", { name: reason, exact: true }).click()
}

async function newPatient(page: Page, name: string, phoneSeed: number) {
  await createPatient(page, name, uniquePhone(phoneSeed))
  await expectCreated(page)
  return new URL(page.url()).pathname
}

const patientId = (url: string) => url.split("/").pop()!

/** An accepted plan: a root canal and a filling in phase 1, a crown in phase 2. */
async function seedPhases(id: string) {
  const [plan] = await query<{ id: string }>(
    `insert into treatment_plan (id, patient_id, title, status, updated_at)
     values (gen_random_uuid(), $1, 'خطة المواعيد', 'accepted', now()) returning id`,
    [id],
  )
  await query(
    `insert into treatment_plan_item
       (id, plan_id, procedure_id, tooth, surfaces, phase, price, currency, updated_at)
     select gen_random_uuid(), $1, p.id, t.tooth, t.surfaces::text[], t.phase, p.price, 'IQD', now()
     from (values ('علاج عصب - رحى', 36, '{}', 1), ('حشوة تجميلية (كومبوزيت)', 16, '{O}', 1),
                  ('تاج زيركون', 36, '{}', 2)) as t(name, tooth, surfaces, phase)
     join procedure p on p.name = t.name and p.archived_at is null`,
    [plan!.id],
  )
}

test("book from the patient: a visit outside a plan needs a reason", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 2 : 3)
  const name = `مريض موعد ${testInfo.project.name}`

  await loginAsOwner(page)
  const patientUrl = await newPatient(page, name, desktop ? 71 : 72)

  // Booking starts on the patient page: the header has no "new appointment" any more.
  await expect(page.getByRole("button", { name: "موعد جديد" })).toHaveCount(0)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(`موعد جديد لـ ${name}`)
  await dialog.getByLabel("التاريخ").fill(date)
  await pickTime(page, "4:00 م")
  await expect(dialog.getByText("لا توجد حجوزات في هذا اليوم")).toBeVisible()

  // No plan: a reason is required.
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(dialog.getByText("اختر علاجاً من الخطة أو سبب الزيارة")).toBeVisible()
  await pickReason(page, "استشارة")
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()

  // WhatsApp confirmation, in Arabic, with the time the Iraqi way and the reason.
  const wa = page.getByRole("dialog", { name: /رسالة واتساب/ })
  await expect(wa.getByLabel("نص الرسالة")).toHaveValue(/تأكيد الموعد[\s\S]*4:00/)
  await expect(wa.getByLabel("نص الرسالة")).toHaveValue(/استشارة/)
  await wa.getByRole("button", { name: "تخطي" }).click()

  // Patient's appointments tab.
  await page.goto(`${patientUrl}/appointments`)
  const card = page.locator("article[data-appointment]").first()
  await expect(card).toContainText("4:00 م")
  await expect(card).toContainText("بانتظار")
  await expect(card).toContainText("استشارة")

  // The calendar doesn't start or finish visits: it opens the patient instead.
  await page.goto(`/appointments?date=${date}`)
  const visit = page.locator("article[data-appointment]", { hasText: name })
  await expect(visit.getByRole("button", { name: "بدء" })).toHaveCount(0)
  await expect(visit.getByRole("link", { name: "ملف المريض" })).toBeVisible()
  await expect(page.getByText("الأوقات المحجوزة")).toHaveCount(0)

  // Dashboard calendar shows it on that day.
  await page.goto(`/dashboard?cal=${date}&view=week`)
  await expect(page.locator(`[data-day="${date}"]`)).toContainText(name)
})

test("a visit for the plan: next phase ticked, finish records what was done", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 10 : 11)
  const name = `مريض خطة موعد ${testInfo.project.name}`

  await loginAsOwner(page)
  const patientUrl = await newPatient(page, name, desktop ? 301 : 302)
  await seedPhases(patientId(patientUrl))

  // The plan: no visit booked, and the visits it still needs (2–3 + 1 + 2–3).
  await page.goto(`${patientUrl}/plans`)
  await expect(page.getByTestId("next-visit")).toContainText("لا يوجد موعد قادم")
  await expect(page.getByTestId("visits-left")).toContainText("5–7")

  // Book the next visit: phase 1 comes ticked, with the chair time of both treatments.
  await page.getByRole("button", { name: "حجز الزيارة التالية" }).click()
  const dialog = page.getByRole("dialog")
  const items = dialog.getByTestId("plan-items")
  await expect(items.getByRole("checkbox", { name: "علاج عصب - رحى 36" })).toBeChecked()
  await expect(items.getByRole("checkbox", { name: "حشوة تجميلية (كومبوزيت) 16" })).toBeChecked()
  await expect(items.getByRole("checkbox", { name: "تاج زيركون 36" })).not.toBeChecked()
  await expect(items).toContainText("الزيارة 1 من 2–3")
  await expect(dialog.getByLabel("المدة (دقيقة)")).toHaveValue("120")
  await expect(dialog.getByLabel("سبب الزيارة")).toHaveCount(0)
  await dialog.getByLabel("التاريخ").fill(date)
  await pickTime(page, "5:00 م")
  await dialog.getByLabel("إرسال تأكيد عبر واتساب").uncheck()
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()
  await expect(page.getByTestId("next-visit")).toContainText("الموعد القادم")

  // The day comes: move the visit to now (without a dentist or room, so the desktop and
  // phone runs don't overlap).
  await query(
    `update appointment set starts_at = now() - interval '5 minutes',
       ends_at = now() + interval '115 minutes', dentist_id = null, room_id = null
     where patient_id = $1`,
    [patientId(patientUrl)],
  )

  // Start and finish happen on the patient page.
  await page.goto(patientUrl)
  const bar = page.getByTestId("today-visit")
  await expect(bar).toContainText("علاج عصب - رحى 36، حشوة تجميلية (كومبوزيت) 16")
  await bar.getByRole("button", { name: "بدء" }).click()
  await expect(bar).toContainText("قيد التنفيذ")
  await bar.getByRole("button", { name: "إنهاء الزيارة وتسجيل ما تم", exact: true }).click()

  // Each booked treatment needs an outcome before the visit can finish.
  const finish = page.getByRole("dialog", { name: /إنهاء زيارة/ })
  const submit = finish.getByRole("button", { name: "إنهاء الزيارة", exact: true })
  await expect(submit).toBeDisabled()
  await expect(finish).toContainText("اختر ما تم لكل علاج محجوز.")
  await finish
    .locator("[data-item='حشوة تجميلية (كومبوزيت) 16']")
    .getByRole("radio", { name: "تم", exact: true })
    .click()
  await finish
    .locator("[data-item='علاج عصب - رحى 36']")
    .getByRole("radio", { name: "يحتاج زيارة أخرى" })
    .click()
  await submit.click()
  await expect(page.getByText("تم إنهاء الزيارة")).toBeVisible()
  await expect(page.getByRole("dialog", { name: /رسالة واتساب/ })).toContainText("اكتمال العلاج")
  await page.getByRole("button", { name: "تخطي" }).click()

  // The plan moved on: the filling is done, the root canal continues, fewer visits left.
  await page.goto(`${patientUrl}/plans`)
  const plan = page.locator("[data-plan='خطة المواعيد']")
  await expect(plan.locator("[data-item='حشوة تجميلية (كومبوزيت)']")).toContainText("منجز")
  await expect(plan.locator("[data-item='علاج عصب - رحى']")).toContainText("قيد التنفيذ")
  await expect(page.getByTestId("visits-left")).toContainText("3–5")
  const outcomes = await query<{ outcome: string }>(
    `select i.outcome from appointment_item i join appointment a on a.id = i.appointment_id
     where a.patient_id = $1 order by i.outcome`,
    [patientId(patientUrl)],
  )
  expect(outcomes.map((o) => o.outcome)).toEqual(["done", "continued"])

  // On the calendar the finished visit is green and says no next visit is booked.
  await page.goto(`/appointments?date=${clinicToday()}`)
  const card = page.locator("article[data-appointment]", { hasText: name })
  await expect(card).toHaveAttribute("data-status", "completed")
  await expect(card.getByTestId("next-appointment")).toContainText("لا يوجد موعد قادم")

  // The next visit continues the root canal: its second visit.
  await page.goto(`${patientUrl}/plans`)
  await page.getByRole("button", { name: "حجز الزيارة التالية" }).click()
  await expect(items.getByRole("checkbox", { name: "علاج عصب - رحى 36" })).toBeChecked()
  await expect(items.getByRole("checkbox", { name: "تاج زيركون 36" })).not.toBeChecked()
  await expect(items).toContainText("الزيارة 2 من 2–3")
})

test("nothing done: only the dentist finishes, as a check-up", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const name = `مريض فحص ${testInfo.project.name}`

  await loginAsOwner(page)
  const patientUrl = await newPatient(page, name, desktop ? 303 : 304)
  await query(
    `insert into appointment (id, patient_id, starts_at, ends_at, status, reason, updated_at)
     values (gen_random_uuid(), $1, now() - interval '10 minutes', now() + interval '20 minutes',
             'in_progress', 'checkup', now())`,
    [patientId(patientUrl)],
  )
  await logout(page)

  // Reception sees the visit but can't finish it.
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(patientUrl)
  const bar = page.getByTestId("today-visit")
  await expect(bar).toContainText("فحص دوري")
  await expect(
    bar.getByRole("button", { name: "إنهاء الزيارة وتسجيل ما تم", exact: true }),
  ).toBeDisabled()
  await logout(page)

  await loginAsOwner(page)
  await page.goto(patientUrl)
  await bar.getByRole("button", { name: "إنهاء الزيارة وتسجيل ما تم", exact: true }).click()
  const finish = page.getByRole("dialog", { name: /إنهاء زيارة/ })
  const submit = finish.getByRole("button", { name: "إنهاء الزيارة", exact: true })
  await expect(submit).toBeDisabled()
  await expect(finish).toContainText("لم يُسجَّل أي علاج")
  await finish.getByLabel("فحص أو استشارة فقط، بدون علاج").check()
  await submit.click()
  await expect(page.getByText("تم إنهاء الزيارة")).toBeVisible()
  await page.getByRole("button", { name: "تخطي" }).click()
  await expect(bar).toHaveCount(0)

  await page.goto(`${patientUrl}/appointments`)
  await expect(page.locator("article[data-appointment]").first()).toHaveAttribute(
    "data-status",
    "completed",
  )
})

test("a booked time and an already-booked patient can't be picked again", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 4 : 5)

  await loginAsOwner(page)
  const first = await newPatient(page, `مريض أول ${testInfo.project.name}`, desktop ? 83 : 84)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(date)
  await pickTime(page, "5:00 م")
  await pickReason(page, "فحص دوري")
  await dialog.getByLabel("إرسال تأكيد عبر واتساب").uncheck()
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()

  // The same patient can't have a second visit that day.
  await page.goto(first)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  await dialog.getByLabel("التاريخ").fill(date)
  await expect(dialog.getByText("المريض لديه موعد في هذا اليوم.")).toBeVisible()
  await page.keyboard.press("Escape")

  // Another patient sees the time as booked.
  await newPatient(page, `مريض ثان ${testInfo.project.name}`, desktop ? 81 : 82)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  await dialog.getByLabel("التاريخ").fill(date)
  await expect(dialog.getByText("وقت واحد محجوز")).toBeVisible()
  await dialog.getByLabel("الوقت").click()
  await expect(page.getByRole("option", { name: /5:00 م/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
})

test("rest days: Fridays and closed days can't be booked", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes shared clinic days")
  const closedDay = clinicDate(6)

  await loginAsOwner(page)
  const patientUrl = await newPatient(page, "مريض أيام الراحة", 305)

  // Fridays are closed by default.
  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(nextFriday())
  await expect(dialog.getByText("العيادة مغلقة في هذا اليوم.")).toBeVisible()
  await expect(dialog.getByRole("button", { name: "حجز الموعد" })).toBeDisabled()
  await page.keyboard.press("Escape")

  // Close a day from the calendar's day popup (which no longer books).
  await page.goto(`/dashboard?cal=${closedDay}&view=week`)
  await page.locator(`[data-day="${closedDay}"]`).click()
  await expect(page.getByRole("dialog").getByRole("button", { name: "موعد جديد" })).toHaveCount(0)
  await page.getByRole("dialog").getByRole("switch").click()
  await expect(page.getByText("تم تحويل اليوم إلى يوم راحة")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(`[data-day="${closedDay}"]`)).toContainText("يوم راحة")

  // Booking that day is refused.
  await page.goto(patientUrl)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  await dialog.getByLabel("التاريخ").fill(closedDay)
  await expect(dialog.getByText("العيادة مغلقة في هذا اليوم.")).toBeVisible()
  await page.keyboard.press("Escape")

  // Reopen it.
  await page.goto(`/dashboard?cal=${closedDay}&view=week`)
  await page.locator(`[data-day="${closedDay}"]`).click()
  await page.getByRole("dialog").getByRole("switch").click()
  await expect(page.getByText("تم فتح اليوم للحجز")).toBeVisible()
})

test("reception can't close days", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
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

  await newPatient(page, "مريض الغرف", 306)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الغرفة").click()
  await expect(page.getByRole("option", { name: "الكرسي 1" })).toBeVisible()
})

test("the day bar shows free and booked times and picks a free one", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 8 : 9)
  const name = `مريض مخطط اليوم ${testInfo.project.name}`

  await loginAsOwner(page)
  await newPatient(page, name, desktop ? 173 : 174)

  await page.getByRole("button", { name: "حجز موعد" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("التاريخ").fill(date)
  const bar = dialog.getByTestId("day-bar")
  await expect(bar.locator("[data-state=taken]")).toHaveCount(0)

  // Tap a free block: it becomes the chosen time.
  await bar.getByRole("button", { name: "4:00 م: متاح" }).click()
  await expect(dialog.getByLabel("الوقت")).toContainText("4:00 م")
  await pickReason(page, "فحص دوري")
  await dialog.getByRole("button", { name: "حجز الموعد" }).click()
  await expect(page.getByText("تم حجز الموعد")).toBeVisible()
  await page
    .getByRole("dialog", { name: /رسالة واتساب/ })
    .getByRole("button", { name: "تخطي" })
    .click()

  // Next booking for the same day: that block is now booked and can't be picked.
  await newPatient(page, `${name} ثانٍ`, desktop ? 175 : 176)
  await page.getByRole("button", { name: "حجز موعد" }).click()
  await dialog.getByLabel("التاريخ").fill(date)
  await expect(bar.locator("[data-state=taken]")).toHaveCount(1)
  await expect(bar.getByRole("button", { name: "4:00 م: محجوز" })).toBeDisabled()
})

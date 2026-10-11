import { expect, test } from "@playwright/test"

import { createPatient, expectCreated, login, query, RECEPTION, uniquePhone } from "./fixtures"

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

/** A waiting appointment written straight to the database (booking has its own tests). */
async function book(patientId: string, date: string, time: string) {
  await query(
    `insert into appointment (id, patient_id, starts_at, ends_at, status, created_at, updated_at)
     values (gen_random_uuid(), $1,
             ($2::date + $3::time) at time zone 'Asia/Baghdad',
             ($2::date + $3::time + interval '30 minutes') at time zone 'Asia/Baghdad',
             'pending', now() - interval '1 day', now())`,
    [patientId, date, time],
  )
}

async function newPatient(page: import("@playwright/test").Page, name: string, seed: number) {
  await createPatient(page, name, uniquePhone(seed))
  await expectCreated(page)
  return new URL(page.url()).pathname.split("/").pop()!
}

test("reception works through the day's reminder list", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const date = clinicDate(desktop ? 21 : 22)
  const first = `مريض تذكير أول ${testInfo.project.name}`
  const second = `مريض تذكير ثانٍ ${testInfo.project.name}`
  const noPhone = `مريض بلا هاتف ${testInfo.project.name}`

  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator("[data-widget=reminders]")).toBeVisible()
  const firstId = await newPatient(page, first, desktop ? 181 : 182)
  const secondId = await newPatient(page, second, desktop ? 183 : 184)
  const noPhoneId = await newPatient(page, noPhone, desktop ? 185 : 186)
  await query("update patient set phone = null where id = $1", [noPhoneId])
  await book(firstId, date, "16:00")
  await book(secondId, date, "16:30")
  await book(noPhoneId, date, "17:00")

  // The reminders tab, on the chosen day.
  await page.goto("/appointments")
  await page.getByRole("link", { name: "التذكيرات" }).click()
  await expect(page).toHaveURL(/\/appointments\/reminders$/)
  await page.goto(`/appointments/reminders?date=${date}`)
  const row = (name: string) => page.locator("li[data-reminder]").filter({ hasText: name })
  await expect(page.locator("li[data-reminder]")).toHaveCount(3)
  await expect(row(noPhone).getByRole("button", { name: "لا يوجد رقم" })).toBeDisabled()

  // Send the first reminder: the clinic's Arabic text, then WhatsApp; the send is logged.
  await row(first).getByRole("button", { name: "إرسال تذكير" }).click()
  const whatsapp = page.getByRole("dialog", { name: /رسالة واتساب/ })
  await expect(whatsapp).toContainText("تذكير بموعد")
  await expect(whatsapp.getByLabel("نص الرسالة")).toHaveValue(new RegExp(`${first}[\\s\\S]*4:00`))
  await whatsapp.getByRole("button", { name: "فتح واتساب" }).click()
  await expect(page.getByText("سُجِّل التذكير")).toBeVisible()
  await expect(row(first)).toHaveAttribute("data-reminder", "sent")
  await expect(row(first).getByTestId("reminder-sent")).toContainText(RECEPTION.name)
  await expect(row(first).getByRole("button", { name: "إرسال مرة أخرى" })).toBeVisible()

  // "Not reminded yet" hides the reminded patient.
  await page.getByRole("link", { name: /لم يُذكَّروا بعد/ }).click()
  await expect(row(first)).toHaveCount(0)
  await expect(row(second)).toHaveCount(1)

  // A reminder sent from the appointment card counts too.
  await page.goto(`/appointments?date=${date}`)
  const card = page.locator("article[data-appointment]").filter({ hasText: second })
  await card.getByRole("button", { name: "إرسال تذكير بالموعد عبر واتساب" }).click()
  await whatsapp.getByRole("button", { name: "فتح واتساب" }).click()
  await expect(page.getByText("سُجِّل التذكير")).toBeVisible()
  await page.goto(`/appointments/reminders?date=${date}`)
  await expect(row(second)).toHaveAttribute("data-reminder", "sent")

  const [logged] = await query<{ n: string }>(
    `select count(*) as n from appointment_reminder r join appointment a on a.id = r.appointment_id
     where a.patient_id = any($1::uuid[])`,
    [[firstId, secondId, noPhoneId]],
  )
  expect(logged!.n).toBe("2")
})

test("the reminder log can't be edited, and assistants have no reminders tab", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "database check; one run is enough")
  const [reminder] = await query<{ id: string }>("select id from appointment_reminder limit 1")
  test.skip(!reminder, "needs a reminder from the test above")
  await expect(
    query("update appointment_reminder set sent_at = now() where id = $1", [reminder!.id]),
  ).rejects.toThrow()
  await expect(
    query("delete from appointment_reminder where id = $1", [reminder!.id]),
  ).rejects.toThrow()

  await query(`update "user" set role = 'assistant' where username = $1`, [RECEPTION.username])
  try {
    await login(page, RECEPTION.username, RECEPTION.password)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto("/appointments")
    await expect(page.getByRole("link", { name: "التذكيرات" })).toHaveCount(0)
    await page.goto("/appointments/reminders")
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
  } finally {
    await query(`update "user" set role = 'reception' where username = $1`, [RECEPTION.username])
  }
})

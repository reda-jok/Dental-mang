import { expect, test, type Page } from "@playwright/test"

import { createPatient, expectCreated, loginAsOwner, query, uniquePhone } from "./fixtures"

/**
 * An invoice that fell due `daysLate` days ago. Written straight to the database: the
 * app only issues invoices dated today, and debts need time to pass.
 */
async function overdueInvoice(patientId: string, number: string, daysLate: number) {
  await query(
    `insert into invoice (id, number, patient_id, kind, issue_date, due_date, subtotal,
                          discount_total, total)
     values (gen_random_uuid(), $1, $2, 'visit', current_date - $3::int - 30,
             current_date - $3::int, 80000, 0, 80000)`,
    [number, patientId, daysLate],
  )
}

/** Opening WhatsApp would leave the test; record the link instead. */
async function captureWindowOpen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (url?: string | URL) => {
      w.opened.push(String(url))
      return null
    }
  })
}

test("overdue debts by age, a WhatsApp reminder, and paying it off", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const name = `مريض متأخر ${testInfo.project.name}`
  await loginAsOwner(page)
  await createPatient(page, name, uniquePhone(desktop ? 111 : 112))
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await overdueInvoice(patientUrl.split("/").pop()!, `INV-E2E-${testInfo.project.name}`, 45)

  // The debts page lists the patient in the 31–60 day group.
  await page.goto("/billing")
  await page.getByRole("link", { name: "الديون المتأخرة" }).click()
  await expect(page).toHaveURL(/\/billing\/debts$/)
  const row = page.locator("[data-debt]", { hasText: name })
  await expect(row).toContainText("متأخر 45 يوماً")
  await expect(row).toContainText("80,000")
  await expect(row).toContainText("لم يُذكَّر بعد")

  // Filtering by age: late more than 30 days yes, more than 60 days no.
  await page.goto("/billing/debts?age=d31_60")
  await expect(page.locator("[data-debt]", { hasText: name })).toHaveCount(1)
  await page.goto("/billing/debts?age=d61_90")
  await expect(page.locator("[data-debt]", { hasText: name })).toHaveCount(0)

  // Remind on WhatsApp: the message has the amount; sending it is logged.
  await page.goto("/billing/debts")
  await captureWindowOpen(page)
  await row.getByRole("button", { name: `تذكير ${name} بالدفع عبر واتساب` }).click()
  const whatsapp = page.getByRole("dialog", { name: /رسالة واتساب/ })
  await expect(whatsapp).toContainText("تذكير بالدفع")
  await expect(whatsapp.getByLabel("نص الرسالة")).toHaveValue(/المبلغ المستحق:\*\s*\W*80,000/)
  await whatsapp.getByRole("button", { name: "فتح واتساب" }).click()
  await expect(page.getByText("تم تسجيل التذكير")).toBeVisible()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/9647\d{9}\?text=/)
  const [reminder] = await query<{ amount: string }>(
    `select r.amount::text from payment_reminder r join patient p on p.id = r.patient_id
     where p.full_name = $1`,
    [name],
  )
  expect(reminder?.amount).toBe("80000.00")
  await expect(row).not.toContainText("لم يُذكَّر بعد")

  // The patient's billing tab warns too.
  await page.goto(`${patientUrl}/billing`)
  const banner = page.getByRole("alert").filter({ hasText: "متأخر على المريض" })
  await expect(banner).toContainText("80,000")
  await expect(banner).toContainText("منذ 45 يوماً")
  await expect(banner).toContainText("آخر تذكير")

  // Paying it off clears the debt.
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await page.getByRole("dialog").getByLabel("المبلغ (دينار)").fill("80000")
  await page.getByRole("dialog").getByRole("button", { name: "تسجيل الدفعة" }).click()
  await expect(page.getByText(/تم تسجيل الدفعة/)).toBeVisible()
  await expect(banner).toHaveCount(0)
  await page.goto("/billing/debts")
  await expect(page.locator("[data-debt]", { hasText: name })).toHaveCount(0)
})

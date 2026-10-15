import { expect, test, type Locator } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  loginAsOwner,
  newPatientWithPlan,
  query,
  uniquePhone,
} from "./fixtures"

async function choose(scope: Locator, label: string, option: string) {
  await scope.getByLabel(label).click()
  await scope.page().getByRole("option", { name: option }).click()
}

test("a plan billed up front and paid in monthly installments", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(
    page,
    `مريض أقساط ${testInfo.project.name}`,
    desktop ? 211 : 212,
  )

  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /خطة علاج كاملة/ }).click()
  await dialog.getByRole("button", { name: /أقساط شهرية/ }).click()
  // One due date no longer applies: the installments have their own.
  await expect(dialog.getByLabel("تاريخ الاستحقاق")).toHaveCount(0)

  // 1,250,000: 30% today, then three months in whole thousands, the last takes the rest.
  await choose(dialog, "عدد الأقساط", "3 أشهر")
  await choose(dialog, "الدفعة الأولى", "30٪ اليوم")
  const preview = dialog.getByTestId("installment-preview")
  await expect(preview.getByRole("listitem")).toHaveCount(4)
  await expect(preview.getByRole("listitem").first()).toContainText("375,000")
  await expect(preview.getByRole("listitem").last()).toContainText("293,000")

  await dialog.getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  const schedule = page.getByTestId("installments")
  await expect(schedule.getByRole("listitem")).toHaveCount(4)
  await expect(schedule.locator('[data-installment="due"]')).toHaveCount(4)
  await expect(page.getByText("موعد آخر قسط")).toBeVisible()
})

test("only installments already due count as late", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const name = `مريض قسط متأخر ${testInfo.project.name}`
  await loginAsOwner(page)
  await createPatient(page, name, uniquePhone(desktop ? 201 : 202))
  await expectCreated(page)
  const patientId = new URL(page.url()).pathname.split("/").pop()!

  // Issued 70 days ago: 100,000 due then, 100,000 due 40 days ago, 100,000 due in 10 days.
  // Written straight to the database (in one statement, as the installments must add up
  // to the total at commit): the app only issues invoices dated today.
  const [invoice] = await query<{ id: string }>(
    `with invoice as (
       insert into invoice (id, number, patient_id, kind, issue_date, due_date, subtotal,
                            discount_total, total)
       values (gen_random_uuid(), $1, $2, 'visit', current_date - 70, current_date + 10,
               300000, 0, 300000)
       returning id),
     installments as (
       insert into invoice_installment (id, invoice_id, seq, due_date, amount)
       select gen_random_uuid(), invoice.id, s.seq, current_date + s.days, 100000
       from invoice, (values (1, -70), (2, -40), (3, 10)) as s(seq, days))
     select id from invoice`,
    [`INV-E2E-INST-${testInfo.project.name}`, patientId],
  )

  // The debts page asks for the two installments that are due, not the whole invoice.
  await page.goto("/billing/debts")
  const row = page.locator("[data-debt]", { hasText: name })
  await expect(row).toContainText("200,000")
  await expect(row).toContainText("متأخر 70 يوماً")

  await page.goto(`/billing/${invoice!.id}`)
  const schedule = page.getByTestId("installments")
  await expect(schedule.locator('[data-installment="late"]')).toHaveCount(2)
  await expect(schedule.locator('[data-installment="due"]')).toHaveCount(1)

  // The database keeps the schedule as issued.
  await expect(
    query(`update invoice_installment set amount = 1 where invoice_id = $1`, [invoice!.id]),
  ).rejects.toThrow(/never change/)
})

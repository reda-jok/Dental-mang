import { expect, test, type Page } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  newPatientWithPlan,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

/** A printable page: the toolbar shows on screen, not on paper; one page per copy. */
async function expectPrintable(page: Page, pages = 1) {
  await expect(page.getByRole("button", { name: "طباعة" })).toBeVisible()
  await page.emulateMedia({ media: "print" })
  await expect(page.getByRole("button", { name: "طباعة" })).toBeHidden()
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(pages)
  await page.emulateMedia({ media: "screen" })
}

/** Quote copies are fitted to the page in the browser; wait until that's done. */
async function expectFitted(page: Page, copies: number) {
  await expect(page.locator("[data-fitted]")).toHaveCount(copies)
}

test("print a payment receipt, an invoice and a plan quote", async ({ page }, testInfo) => {
  const name = `مريض طباعة ${testInfo.project.name}`
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(
    page,
    name,
    testInfo.project.name === "desktop" ? 131 : 132,
  )

  // Issue and pay; the toast offers the receipt.
  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  const invoicePage = page.url()
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await page.getByRole("dialog").getByRole("radio", { name: /محفظة/ }).click()
  await page
    .getByRole("dialog")
    .getByLabel(/رقم العملية/)
    .fill("FIB-445566")
  await page.getByRole("dialog").getByRole("button", { name: "تسجيل الدفعة" }).click()
  const [receipt] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "طباعة الإيصال" }).click(),
  ])
  await expect(receipt).toHaveURL(/\/print\/receipt\/[0-9a-f-]{36}\?print=1$/)
  await expect(receipt.getByText("إيصال قبض")).toBeVisible()
  await expect(receipt.getByText(/^RC-\d{4}-\d{6}$/)).toBeVisible()
  await expect(receipt.getByText(name)).toBeVisible()
  await expect(receipt.getByTestId("receipt-amount")).toHaveText(/50,000/)
  await expect(receipt.getByText("FIB-445566")).toBeVisible()
  await expect(receipt.getByText(/^INV-\d{4}-\d{6}$/)).toBeVisible()
  await expectPrintable(receipt)
  await receipt.close()

  // The invoice slip, from the invoice page.
  await page.goto(invoicePage)
  const [slip] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "طباعة الفاتورة" }).click(),
  ])
  await expect(slip.getByText("حشوة تجميلية (كومبوزيت)").first()).toBeVisible()
  await expect(slip.getByText("فاتورة", { exact: true })).toBeVisible()
  await expectPrintable(slip)
  await slip.close()

  // The plan quote (A4), from the plans tab.
  await page.goto(`${patientUrl}/plans`)
  const [quote] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "طباعة عرض السعر" }).click(),
  ])
  // Both copies by default: the patient's (chart, timeline, explanations, payment) and
  // the clinic's signed agreement. No print dialog yet: the options come first.
  await expect(quote).toHaveURL(/\/print\/quote\/[0-9a-f-]{36}\?print=1$/)
  const patient = quote.locator("[data-copy=patient]")
  const clinic = quote.locator("[data-copy=clinic]")
  await expect(patient.getByText("نسخة المريض")).toBeVisible()
  await expect(patient.getByText("خطة الفوترة")).toBeVisible()
  await expect(patient.getByTestId("quote-total")).toHaveText(/1,250,000/)
  const chart = patient.getByTestId("plan-chart")
  await expect(chart.locator("[data-phase]")).toHaveCount(3) // 16, 26, 36
  await expect(chart.locator("[data-tooth='16']")).toContainText("✓") // done
  await expect(patient.getByTestId("timeline")).toContainText("على الكرسي")
  await expect(patient.getByTestId("explanations")).toContainText("جذر صناعي يُثبَّت في عظم الفك")
  await expect(patient.getByText("المدفوع حتى الآن")).toBeVisible() // the 50,000 paid above
  await expect(clinic.getByText("نسخة العيادة")).toBeVisible()
  await expect(clinic.getByText("أقرّ بأن الطبيب شرح لي")).toBeVisible()
  await expect(clinic.getByText("توقيع المريض")).toBeVisible()
  await expectFitted(quote, 2)
  await expectPrintable(quote, 2)

  // Six monthly installments with a 30% deposit; the patient copy alone is one page.
  await quote.getByLabel("النسخ").selectOption("patient")
  await quote.getByLabel("طريقة الدفع").selectOption("months")
  await quote.getByLabel("عدد الأقساط").selectOption("6")
  await quote.getByLabel("الدفعة الأولى (للأقساط)").selectOption("30")
  await quote.getByRole("button", { name: "تحديث" }).click()
  await expect(quote.locator("[data-copy=clinic]")).toHaveCount(0)
  const schedule = quote.getByTestId("schedule")
  await expect(schedule.locator("[data-kind=month]")).toHaveCount(6)
  await expect(schedule.locator("[data-kind=deposit]")).toHaveCount(1)
  await expectFitted(quote, 1)
  await expectPrintable(quote)
})

test("a big plan still prints on one A5 page", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  await loginAsOwner(page)
  await createPatient(
    page,
    `مريض خطة كبيرة ${testInfo.project.name}`,
    uniquePhone(desktop ? 177 : 178),
  )
  await expectCreated(page)
  const patientId = new URL(page.url()).pathname.split("/").pop()!
  const [plan] = await query<{ id: string }>(
    `insert into treatment_plan (id, patient_id, title, status, updated_at)
     values (gen_random_uuid(), $1, 'خطة شاملة', 'proposed', now()) returning id`,
    [patientId],
  )
  // 15 treatments over 3 phases, on 15 different teeth, from 8 explained procedures.
  await query(
    `insert into treatment_plan_item (id, plan_id, procedure_id, tooth, surfaces, phase, price, currency, updated_at)
     select gen_random_uuid(), $1, p.id, t.tooth, '{}', t.phase, p.price, 'IQD', now()
     from (values ('تنظيف وتلميع', null, 1), ('أشعة بانوراما', null, 1),
                  ('حشوة تجميلية', 16, 1), ('حشوة تجميلية', 26, 1), ('حشوة تجميلية', 46, 1),
                  ('علاج عصب - رحى', 36, 2), ('علاج عصب - رحى', 47, 2), ('علاج عصب - ضاحك', 24, 2),
                  ('قلع جراحي', 38, 2), ('قلع جراحي', 48, 2),
                  ('تاج زيركون', 36, 3), ('تاج زيركون', 47, 3), ('تاج زيركون', 24, 3),
                  ('زرعة سنية', 37, 3), ('فينير', 11, 3)) as t(name, tooth, phase)
     join procedure p on p.name like t.name || '%'`,
    [plan!.id],
  )

  await page.goto(`/print/quote/${plan!.id}?copies=patient&pay=months&months=12`)
  await expect(page.getByTestId("timeline").locator("tbody tr:not(:first-child)")).toHaveCount(15)
  await expectFitted(page, 1)
  // Too big for the explanations: they're the first thing left out.
  await expect(page.getByTestId("explanations")).toBeHidden()
  await expectPrintable(page)
})

test("reception prints receipts but not treatment quotes", async ({ page }) => {
  const [plan] = await query<{ id: string }>("select id from treatment_plan limit 1")
  const [payment] = await query<{ id: string }>("select id from payment limit 1")
  test.skip(!plan || !payment, "needs data from the other tests")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/print/receipt/${payment!.id}`)
  await expect(page.getByText("إيصال قبض")).toBeVisible()
  await page.goto(`/print/quote/${plan!.id}`)
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

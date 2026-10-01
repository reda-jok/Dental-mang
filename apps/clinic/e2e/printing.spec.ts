import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, newPatientWithPlan, query, RECEPTION } from "./fixtures"

/** A printable page: the toolbar shows on screen, not on paper; it fits on one page. */
async function expectPrintable(page: Page) {
  await expect(page.getByRole("button", { name: "طباعة" })).toBeVisible()
  await page.emulateMedia({ media: "print" })
  await expect(page.getByRole("button", { name: "طباعة" })).toBeHidden()
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1)
  await page.emulateMedia({ media: "screen" })
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
  await expect(quote.getByText("عرض سعر خطة علاج")).toBeVisible()
  await expect(quote.getByText("خطة الفوترة")).toBeVisible()
  await expect(quote.getByText("زرعة سنية")).toBeVisible()
  await expect(quote.getByTestId("quote-total")).toHaveText(/1,250,000/)
  await expect(quote.getByText("توقيع المريض")).toBeVisible()
  await expectPrintable(quote)
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

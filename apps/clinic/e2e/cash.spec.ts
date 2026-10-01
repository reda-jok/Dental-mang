import { expect, test, type Page } from "@playwright/test"

import { loginAsOwner, newPatientWithPlan, query } from "./fixtures"

/** Issues an invoice for the patient's done treatments and pays it in cash. */
async function cashVisit(page: Page, name: string, phoneSeed: number) {
  const patientUrl = await newPatientWithPlan(page, name, phoneSeed)
  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "تسجيل الدفعة" }).click()
  await expect(page.getByText(/تم تسجيل الدفعة/)).toBeVisible()
}

const digits = (text: string) => BigInt(text.replace(/[^\d]/g, ""))

test("close the day's cash drawer with a shortage", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "one close per day; the phone run checks the result",
  )
  await loginAsOwner(page)
  await cashVisit(page, "مريض صندوق", 121)

  await page.goto("/billing")
  await page.getByRole("link", { name: "إغلاق الصندوق" }).click()
  await expect(page).toHaveURL(/\/billing\/cash$/)
  const expected = digits((await page.getByTestId("expected-cash").textContent()) ?? "")
  expect(expected).toBeGreaterThanOrEqual(50_000n)
  await expect(page.locator("[data-movement]").first()).toBeVisible()

  // 2,000 short: the form says so, and asks why before closing.
  await page.getByLabel("النقد المعدود (دينار)").fill(String(expected - 2_000n))
  await expect(page.locator("[data-outcome=short]")).toContainText("2,000")
  await page.getByRole("button", { name: "إغلاق الصندوق" }).click()
  await expect(page.getByText("اكتب سبب الفرق قبل الإغلاق")).toBeVisible()
  await page.getByLabel(/ملاحظة/).fill("فكة أُعطيت لمريض")
  await page.getByRole("button", { name: "إغلاق الصندوق" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "تأكيد الإغلاق" }).click()
  await expect(page.getByText("تم إغلاق الصندوق", { exact: true })).toBeVisible()
  await expect(page.locator("[data-closed-today]")).toContainText("عجز في الصندوق")

  // Stored with every movement it took in, and the shortage is in the books.
  const [close] = await query<{ difference: string; items: string; code: string; debit: string }>(
    `select c.difference::text, (select count(*) from cash_close_item i where i.close_id = c.id)::text as items,
            a.code, l.debit::text
     from cash_close c
     join journal_line l on l.entry_id = c.journal_entry_id and l.debit > 0
     join ledger_account a on a.id = l.account_id
     where c.day = (now() at time zone 'Asia/Baghdad')::date`,
  )
  expect(close).toMatchObject({ difference: "-2000.00", code: "5800", debit: "2000.00" })
  expect(Number(close!.items)).toBeGreaterThan(0)
  await expect(page.locator("[data-close]").first()).toContainText("عجز في الصندوق: ")

  // Money taken after closing waits for tomorrow's close.
  await cashVisit(page, "مريض بعد الإغلاق", 122)
  await page.goto("/billing/cash")
  await expect(page.locator("[data-closed-today]")).toContainText("بعد الإغلاق")
  await expect(page.getByRole("button", { name: "إغلاق الصندوق" })).toHaveCount(0)
})

test("the cash page shows today's state", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/billing/cash")
  // Either today's count form or, once closed, today's result.
  await expect(
    page.locator("[data-closed-today], [data-testid=expected-cash]").first(),
  ).toBeVisible()
  await expect(page.getByText("سجل الإغلاقات")).toBeVisible()
})

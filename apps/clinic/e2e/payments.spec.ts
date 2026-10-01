import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, newPatientWithPlan, query, RECEPTION } from "./fixtures"

/** Issues the default invoice from the patient's billing tab (all done treatments). */
async function issueInvoice(page: Page, patientUrl: string, kind: "visit" | "plan" = "visit") {
  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  const dialog = page.getByRole("dialog")
  if (kind === "plan") await dialog.getByRole("button", { name: /خطة علاج كاملة/ }).click()
  await dialog.getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
}

async function pay(
  page: Page,
  amount: string,
  method: RegExp,
  options: { reference?: string; doubleClick?: boolean } = {},
) {
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("المبلغ (دينار)").fill(amount)
  await dialog.getByRole("radio", { name: method }).click()
  if (options.reference) await dialog.getByLabel(/رقم العملية/).fill(options.reference)
  const submit = dialog.getByRole("button", { name: "تسجيل الدفعة" })
  if (options.doubleClick) await submit.dblclick()
  else await submit.click()
  await expect(page.getByText(/تم تسجيل الدفعة RC-\d{4}-\d{6}/).first()).toBeVisible()
  await expect(dialog).toBeHidden()
}

const summary = (page: Page, key: string) => page.locator(`[data-summary=${key}]`)

test("partial payments, overpayment as credit, refund, and a voided payment", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const name = `مريض دفعات ${testInfo.project.name}`
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(page, name, desktop ? 101 : 102)
  await issueInvoice(page, patientUrl) // two fillings: 50,000
  const firstInvoice = page.url()

  // First payment from the invoice page: it defaults to the invoice's balance.
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await expect(page.getByRole("dialog").getByLabel("المبلغ (دينار)")).toHaveValue("50000")
  await page.keyboard.press("Escape")
  await pay(page, "٢٠,٠٠٠", /نقداً/) // Arabic digits and separators
  await expect(page.getByText("مسددة جزئياً")).toBeVisible()
  await expect(page.getByTestId("invoice-total")).toHaveText(/50,000/)

  // Second payment on the patient tab, by wallet, more than is owed. Double-clicking
  // "save" still records it once.
  await page.goto(`${patientUrl}/billing`)
  await expect(summary(page, "balance")).toHaveText(/30,000/)
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await page.getByRole("dialog").getByLabel("المبلغ (دينار)").fill("40000")
  await expect(page.getByRole("dialog")).toContainText(/الزائد \(\W*10,000/)
  await page.keyboard.press("Escape")
  await pay(page, "40000", /محفظة/, { reference: "FIB-778899", doubleClick: true })
  await expect(page.locator("[data-payment]")).toHaveCount(2)
  await expect(page.getByText("رصيد للمريض").first()).toBeVisible()
  await expect(summary(page, "balance")).toHaveText(/10,000/)
  await expect(
    page.locator("[data-invoice]").first().getByText("مسددة", { exact: true }),
  ).toBeVisible()

  // The wallet payment is in the books: Dr wallets, Cr patient receivables.
  const posting = await query<{ code: string; debit: string; credit: string }>(
    `select a.code, l.debit::text, l.credit::text from payment p
     join patient pt on pt.id = p.patient_id
     join journal_line l on l.entry_id = p.journal_entry_id
     join ledger_account a on a.id = l.account_id
     where pt.full_name = $1 and p.method = 'wallet' order by a.code`,
    [name],
  )
  expect(posting).toEqual([
    { code: "1020", debit: "40000.00", credit: "0.00" },
    { code: "1100", debit: "0.00", credit: "40000.00" },
  ])

  // Give part of the credit back.
  await page.getByRole("button", { name: "استرجاع مبلغ" }).click()
  const refund = page.getByRole("dialog")
  await expect(refund.getByLabel("المبلغ (دينار)")).toHaveValue("10000")
  await refund.getByLabel("المبلغ (دينار)").fill("15000")
  await refund.getByLabel("سبب الاسترجاع").fill("عربون زائد")
  await refund.getByRole("button", { name: "استرجاع المبلغ" }).click()
  await expect(refund).toContainText("أكبر من رصيد المريض")
  await refund.getByLabel("المبلغ (دينار)").fill("5000")
  await refund.getByRole("button", { name: "استرجاع المبلغ" }).click()
  await expect(page.getByText(/تم تسجيل الاسترجاع RF-/)).toBeVisible()
  await expect(summary(page, "balance")).toHaveText(/5,000/)
  await expect(page.locator("[data-refund]")).toHaveCount(1)

  // The next invoice uses the remaining credit automatically.
  await issueInvoice(page, patientUrl, "plan") // the implant: 1,200,000
  await expect(page.getByText("مسددة جزئياً")).toBeVisible()
  await expect(page.getByRole("region", { name: "الدفعات على هذه الفاتورة" })).toContainText(
    "5,000",
  )

  // Void the cash payment (entered by mistake): the first invoice is owed again.
  await page.goto(`${patientUrl}/billing`)
  const cash = page.locator("[data-payment]").filter({ hasText: "نقداً" })
  await cash.getByRole("button", { name: /إلغاء الدفعة/ }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByLabel("سبب الإلغاء").fill("مبلغ خاطئ")
  await confirm.getByRole("button", { name: /إلغاء الدفعة/ }).click()
  await expect(page.getByText(/تم إلغاء الدفعة/)).toBeVisible()
  await expect(cash).toContainText("ملغاة: مبلغ خاطئ")
  // Invoiced 1,250,000 − received 40,000 + refunded 5,000.
  await expect(summary(page, "balance")).toHaveText(/1,215,000/)
  await page.goto(firstInvoice)
  await expect(page.getByText("مسددة جزئياً")).toBeVisible()

  // Every money row is audited.
  const audit = await query<{ entity: string; count: string }>(
    `select entity, count(*)::text from audit_log
     where entity in ('payment', 'refund') and entity_id in (
       select id::text from payment where patient_id = (select id from patient where full_name = $1)
       union all
       select id::text from refund where patient_id = (select id from patient where full_name = $1))
     group by entity order by entity`,
    [name],
  )
  expect(audit).toEqual([
    { entity: "payment", count: "3" }, // two payments + one void
    { entity: "refund", count: "1" },
  ])
})

test("reception takes payments but can't refund or void them", async ({ page }, testInfo) => {
  const name = `مريض دفع استقبال ${testInfo.project.name}`
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  const patientUrl = await newPatientWithPlan(
    page,
    name,
    testInfo.project.name === "desktop" ? 103 : 104,
  )
  await issueInvoice(page, patientUrl)
  await pay(page, "60000", /بطاقة/) // 10,000 more than owed → credit

  await page.goto(`${patientUrl}/billing`)
  await expect(summary(page, "balance")).toHaveText(/10,000/)
  // Refunds and voids are the owner's to grant (Settings → Permissions).
  await expect(page.getByRole("button", { name: "استرجاع مبلغ" })).toBeDisabled()
  await expect(
    page.locator("[data-payment]").getByRole("button", { name: /إلغاء الدفعة/ }),
  ).toBeDisabled()
})

test("the billing page filters paid invoices and shows money by method", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/billing?status=paid")
  const rows = page.locator("[data-invoice]")
  await expect(rows.first().getByText("مسددة", { exact: true })).toBeVisible()
  await expect(rows.filter({ hasText: /غير مسددة|جزئياً|متأخرة/ })).toHaveCount(0)
  await page.goto("/billing")
  await expect(page.getByText("طرق الدفع هذا الشهر")).toBeVisible()
  await expect(page.getByText("محفظة إلكترونية")).toBeVisible()
  await expect(page.getByText(/المُحصَّل هذا الشهر/)).toBeVisible()
})

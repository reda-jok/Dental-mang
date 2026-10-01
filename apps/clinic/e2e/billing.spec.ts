import { expect, test, type Page } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

/**
 * A treatment plan for the patient, written straight to the database (charting has its
 * own tests): two fillings already done, an implant still planned.
 */
async function seedPlan(patientId: string) {
  const [plan] = await query<{ id: string }>(
    `insert into treatment_plan (id, patient_id, title, status, updated_at)
     values (gen_random_uuid(), $1, 'خطة الفوترة', 'accepted', now()) returning id`,
    [patientId],
  )
  await query(
    `insert into treatment_plan_item
       (id, plan_id, procedure_id, tooth, surfaces, price, currency, status, completed_at, updated_at)
     select gen_random_uuid(), $1, p.id, t.tooth, '{}', p.price, 'IQD', t.status::"PlanItemStatus",
            case when t.status = 'done' then now() end, now()
     from (values ('حشوة تجميلية', 16, 'done'), ('حشوة تجميلية', 26, 'done'),
                  ('زرعة سنية', 36, 'planned')) as t(name, tooth, status)
     join procedure p on p.name like t.name || '%'`,
    [plan!.id],
  )
  return plan!.id
}

async function newPatientWithPlan(page: Page, name: string, phoneSeed: number) {
  await createPatient(page, name, uniquePhone(phoneSeed))
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await seedPlan(patientUrl.split("/").pop()!)
  return patientUrl
}

const total = (page: Page) => page.getByRole("dialog").getByTestId("invoice-total")

test("issue a visit invoice with a discount, then void it", async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const name = `مريض فاتورة ${testInfo.project.name}`
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(page, name, desktop ? 91 : 92)

  // The billing page lists the patient as waiting to be billed.
  await page.goto("/billing")
  const waiting = page.getByRole("listitem").filter({ hasText: name })
  await expect(waiting).toContainText("علاجان")
  await waiting.getByRole("link", { name: "إصدار فاتورة" }).click()

  // The form opens with the done treatments ticked; the planned implant isn't offered.
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "فاتورة جديدة" })).toBeVisible()
  await expect(dialog.getByRole("checkbox")).toHaveCount(2)
  await expect(dialog.getByRole("checkbox", { name: /زرعة/ })).toHaveCount(0)
  await expect(total(page)).toHaveText(/50,000/)

  // Untick one, tick it back; discount one filling; add a procedure from the catalog.
  await dialog.getByRole("checkbox").first().click()
  await expect(total(page)).toHaveText(/25,000/)
  await dialog.getByRole("checkbox").first().click()
  await dialog.getByLabel(/خصم حشوة تجميلية.*16/).fill("٥,٠٠٠")
  await expect(total(page)).toHaveText(/45,000/)
  await dialog.getByLabel("إضافة علاج من القائمة").click()
  await page.getByRole("option", { name: /زرعة سنية/ }).click()
  await expect(total(page)).toHaveText(/1,245,000/)
  await dialog.getByRole("button", { name: "إزالة زرعة سنية" }).click()
  await expect(total(page)).toHaveText(/45,000/)

  // A discount bigger than the price is refused before anything is sent.
  await dialog.getByLabel(/خصم على الفاتورة/).fill("50000")
  await expect(dialog).toContainText("الخصم أكبر من مجموع الفاتورة")
  await dialog.getByLabel(/خصم على الفاتورة/).fill("")

  await dialog.getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page.getByText(/تم إصدار الفاتورة INV-\d{4}-\d{6}/)).toBeVisible()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId("invoice-total")).toHaveText(/45,000/)
  await expect(page.getByText("غير مسددة")).toBeVisible()
  const invoiceId = page.url().split("/").pop()!

  // Stored as issued, with a balanced journal entry: revenue gross, discount on its own.
  const posting = await query<{ code: string; debit: string; credit: string }>(
    `select a.code, l.debit::text, l.credit::text
     from invoice i join journal_line l on l.entry_id = i.journal_entry_id
     join ledger_account a on a.id = l.account_id
     where i.id = $1 order by a.code`,
    [invoiceId],
  )
  expect(posting).toEqual([
    { code: "1100", debit: "45000.00", credit: "0.00" },
    { code: "4000", debit: "0.00", credit: "50000.00" },
    { code: "4100", debit: "5000.00", credit: "0.00" },
  ])

  // A plan with billed treatment can't be cancelled until the invoice is voided.
  await page.goto(`${patientUrl}/plans`)
  await page.getByRole("button", { name: /إلغاء الخطة/ }).click()
  await expect(page.getByText("في هذه الخطة علاجات مُفوترة")).toBeVisible()

  // Patient tab: totals and the invoice; nothing done is left to bill.
  await page.goto(`${patientUrl}/billing`)
  await expect(page.locator("[data-summary=invoiced]")).toHaveText(/45,000/)
  await expect(page.locator("[data-invoice]")).toHaveCount(1)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  await expect(page.getByRole("dialog")).toContainText("لا توجد علاجات منجزة")
  await page.keyboard.press("Escape")

  // Void it: a reason is required; the entry is reversed and the fillings can be billed again.
  await page.goto(`/billing/${invoiceId}`)
  await page.getByRole("button", { name: "إلغاء الفاتورة" }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: "إلغاء الفاتورة" }).click()
  await expect(confirm).toContainText("هذا الحقل مطلوب")
  await confirm.getByLabel("سبب الإلغاء").fill("اختيار علاج خاطئ")
  await confirm.getByRole("button", { name: "إلغاء الفاتورة" }).click()
  await expect(page.getByText(/تم إلغاء الفاتورة/)).toBeVisible()
  await expect(page.getByText("سبب الإلغاء: اختيار علاج خاطئ")).toBeVisible()
  await expect(page.getByText(/عُكس بالقيد JE-/)).toBeVisible()

  const [released] = await query<{ count: string }>(
    `select count(*) from treatment_plan_item i join treatment_plan p on p.id = i.plan_id
     join patient pt on pt.id = p.patient_id where pt.full_name = $1 and i.invoice_id is null`,
    [name],
  )
  expect(released?.count).toBe("3")
  const audit = await query("select 1 from audit_log where entity = 'invoice' and entity_id = $1", [
    invoiceId,
  ])
  expect(audit).toHaveLength(2) // issued + voided

  // The list finds it by patient name, shown as void.
  await page.goto(`/billing?q=${encodeURIComponent(name)}&status=void`)
  await expect(page.locator("[data-invoice]")).toHaveCount(1)
  await expect(page.locator("[data-invoice]")).toContainText("ملغاة")
})

test("a whole plan billed up front", async ({ page }, testInfo) => {
  const name = `مريض خطة ${testInfo.project.name}`
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(
    page,
    name,
    testInfo.project.name === "desktop" ? 93 : 94,
  )

  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: /خطة علاج كاملة/ }).click()
  await expect(dialog.getByRole("checkbox")).toHaveCount(3) // planned work included
  await expect(total(page)).toHaveText(/1,250,000/)
  await dialog.getByLabel("تاريخ الاستحقاق").fill("2020-01-01")
  await dialog.getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(dialog).toContainText("تاريخ الاستحقاق لا يمكن أن يكون قبل اليوم")
  const later = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
  await dialog.getByLabel("تاريخ الاستحقاق").fill(later)
  await dialog.getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  await expect(page.getByText("خطة الفوترة")).toBeVisible()
  await expect(page.getByTestId("invoice-total")).toHaveText(/1,250,000/)
})

test("reception issues invoices but can't void them", async ({ page }, testInfo) => {
  const name = `مريض استقبال فاتورة ${testInfo.project.name}`
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  const patientUrl = await newPatientWithPlan(
    page,
    name,
    testInfo.project.name === "desktop" ? 95 : 96,
  )

  // Reception can't open the chart or plans, but sees what's billable.
  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  await expect(page.getByRole("dialog").getByRole("checkbox")).toHaveCount(2)
  await page.getByRole("dialog").getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)

  // Voiding is the owner's to grant (Settings → Permissions); the button says so.
  const voidButton = page.getByRole("button", { name: "إلغاء الفاتورة" })
  await expect(voidButton).toBeDisabled()
  if (testInfo.project.name === "desktop") {
    await expect(async () => {
      await page.mouse.move(0, 0)
      await voidButton.locator("..").hover()
      await expect(page.getByRole("tooltip")).toContainText("الإعدادات ← الصلاحيات", {
        timeout: 1_000,
      })
    }).toPass()
  }
})

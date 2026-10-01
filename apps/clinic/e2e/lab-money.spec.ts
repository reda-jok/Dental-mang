import { expect, test } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

test("a lab's bill, a cash payment, a discount and the monthly statement", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const labName = `مختبر الحساب ${testInfo.project.name}`
  await loginAsOwner(page)

  await page.goto("/lab/labs")
  await page.getByRole("button", { name: "إضافة مختبر" }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByLabel("اسم المختبر").fill(labName)
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تمت إضافة المختبر")).toBeVisible()

  // A crown sent at 90,000.
  await createPatient(
    page,
    `مريض حساب مختبر ${testInfo.project.name}`,
    uniquePhone(desktop ? 161 : 162),
  )
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await page.goto(`${patientUrl}/lab`)
  await page.getByRole("button", { name: "إرسال للمختبر" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel("العمل").fill("تاج زيركون")
  await dialog.getByLabel("المختبر", { exact: true }).click()
  await page.getByRole("option", { name: labName }).click()
  await dialog.getByLabel(/كلفة المختبر/).fill("90,000")
  await dialog.getByRole("button", { name: "إرسال للمختبر" }).click()
  await expect(page.getByText("تم تسجيل الحالة")).toBeVisible()

  // Back from the lab: its invoice says 85,000, and that becomes the bill.
  const row = page.locator("[data-lab-case]").first()
  await row.getByRole("button", { name: /^استلام .* من المختبر$/ }).click()
  dialog = page.getByRole("dialog")
  const cost = dialog.getByLabel(/كلفة المختبر لهذا العمل/)
  await expect(cost).toHaveValue("90000")
  await cost.fill("85,000")
  await dialog.getByRole("button", { name: "تم الاستلام" }).click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText("بانتظار التركيب")

  // Sent back to be redone: the lab and the cost stay as billed, and it isn't billed again.
  await row.getByRole("button", { name: /^إعادة .* للمختبر$/ }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel(/سبب/).fill("الحافة غير محكمة")
  await dialog.getByRole("button", { name: "إعادة للمختبر" }).click()
  await expect(dialog).toBeHidden()
  await row.getByRole("button", { name: /^تعديل الحالة/ }).click()
  dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel(/كلفة المختبر/)).toHaveAttribute("readonly", "")
  await expect(dialog.getByLabel("المختبر", { exact: true })).toBeDisabled()
  await expect(dialog).toContainText("احتُسبت الكلفة في حساب المختبر")
  await page.keyboard.press("Escape")
  await row.getByRole("button", { name: /^استلام .* من المختبر$/ }).click()
  dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("الإعادة لا تُحتسب مرة أخرى")
  await dialog.getByRole("button", { name: "تم الاستلام" }).click()
  await expect(dialog).toBeHidden()
  const bills = await query<{ cost: string; entries: string }>(
    `select c.cost::text, (select count(*) from journal_entry e where e.source_type = 'lab_bill' and e.source_id = c.id)::text as entries
     from lab_case c join lab l on l.id = c.lab_id where l.name = $1`,
    [labName],
  )
  expect(bills).toEqual([{ cost: "85000.00", entries: "1" }])

  // What the clinic owes the lab; pay part of it in cash.
  await page.goto("/lab/accounts")
  const account = page.locator(`[data-lab-account='${labName}']`)
  await expect(account.locator("[data-owed]")).toContainText("85,000")
  await account.getByRole("button", { name: `دفع لـ ${labName}` }).click()
  dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("المبلغ (دينار)")).toHaveValue("85000")
  await dialog.getByLabel("المبلغ (دينار)").fill("50,000")
  await dialog.getByRole("button", { name: "تسجيل الدفعة" }).click()
  await expect(page.getByText(/^تم تسجيل الدفعة LP-/)).toBeVisible()
  await expect(account.locator("[data-owed]")).toContainText("35,000")
  const [payment] = await query<{ number: string }>(
    "select p.number from lab_payment p join lab l on l.id = p.lab_id where l.name = $1",
    [labName],
  )

  // The statement, and a month-end discount from the lab.
  await account.getByRole("link", { name: labName, exact: true }).click()
  await expect(page).toHaveURL(/\/lab\/accounts\/[0-9a-f-]{36}$/)
  const statementUrl = new URL(page.url()).pathname
  await expect(page.getByTestId("statement-closing")).toContainText("35,000")
  await expect(page.locator("[data-entry]")).toHaveCount(2)
  await page.getByRole("button", { name: "خصم أو مبلغ إضافي" }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel("المبلغ (دينار)").fill("5000")
  await dialog.getByLabel("السبب").fill("خصم نهاية الشهر")
  await dialog.getByRole("button", { name: "حفظ التسوية" }).click()
  await expect(page.getByText("تم حفظ التسوية")).toBeVisible()
  await expect(page.getByTestId("statement-closing")).toContainText("30,000")

  // The cash came out of the drawer: it's in the next daily close.
  await page.goto("/billing/cash")
  const movement = page.locator(`[data-movement='${payment!.number}']`)
  await expect(movement).toContainText(labName)
  await expect(movement).toContainText("دفع لمختبر")
  await expect(movement).toContainText("50,000")

  // Voided by mistake: owed again, kept on the statement as void.
  await page.goto(statementUrl)
  await page.getByRole("button", { name: `إلغاء الدفعة ${payment!.number}` }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByLabel("سبب الإلغاء").fill("سُجّلت على المختبر الخطأ")
  await confirm.getByRole("button", { name: `إلغاء الدفعة ${payment!.number}` }).click()
  await expect(page.getByText(`أُلغيت الدفعة ${payment!.number}`)).toBeVisible()
  await expect(page.getByTestId("statement-closing")).toContainText("80,000")
  await expect(page.locator(`[data-entry='${payment!.number}']`)).toContainText("ملغاة")

  // The books agree: what's owed to this lab in "accounts payable".
  const [ledger] = await query<{ owed: string }>(
    `select sum(jl.credit - jl.debit)::text as owed
     from journal_line jl
     join journal_entry e on e.id = jl.entry_id
     join ledger_account a on a.id = jl.account_id and a.code = '2000'
     join lab l on l.name = $1
     where e.source_id in (select id from lab_case where lab_id = l.id
                           union all select id from lab_payment where lab_id = l.id
                           union all select id from lab_adjustment where lab_id = l.id)`,
    [labName],
  )
  expect(ledger!.owed).toBe("80000.00")
  // …and the database refuses to rewrite a bill or a payment.
  await expect(
    query("update lab_case set cost = 1 where lab_id = (select id from lab where name = $1)", [
      labName,
    ]),
  ).rejects.toThrow(/billed lab case/)
  await expect(
    query("update lab_payment set amount = 1 where number = $1", [payment!.number]),
  ).rejects.toThrow(/can't be edited/)

  // Printed for the lab, on one page.
  const [print] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "طباعة الكشف" }).click(),
  ])
  await expect(print.getByTestId("statement-lab")).toContainText(labName)
  await expect(print.getByTestId("statement-total")).toContainText("80,000")
  await print.emulateMedia({ media: "print" })
  const pdf = await print.pdf({ preferCSSPageSize: true })
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1)
  await print.close()
})

test("lab accounts are only for roles that handle money", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/lab")
  await expect(page.getByRole("link", { name: "حالات المختبر" })).toBeVisible()
  await expect(page.getByRole("link", { name: "حسابات المختبرات" })).toHaveCount(0)
  await page.goto("/lab/accounts")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

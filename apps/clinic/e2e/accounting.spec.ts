import { expect, test } from "@playwright/test"

import { login, loginAsOwner, query, RECEPTION } from "./fixtures"

test("a cash expense comes out of the drawer, and voiding it puts the cash back", async ({
  page,
}, testInfo) => {
  const description = `وقود المولدة ${testInfo.project.name}`
  await loginAsOwner(page)

  // Record 25,000 for generator fuel, paid from the drawer.
  await page.goto("/accounting")
  await page.getByRole("button", { name: "تسجيل مصروف" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("البند").click()
  await page.getByRole("option", { name: "الكهرباء والمولدة والماء" }).click()
  await dialog.getByLabel("المبلغ (دينار)").fill("٢٥٠٠٠") // Arabic digits
  await dialog.getByRole("radio", { name: "الصندوق" }).click()
  await dialog.getByLabel("الوصف").fill(description)
  await dialog.getByRole("button", { name: "تسجيل المصروف" }).click()
  await expect(page.getByText(/تم تسجيل المصروف EX-\d{4}-\d{6}/)).toBeVisible()
  const row = page.locator("[data-expense]").filter({ hasText: description })
  await expect(row).toContainText("25,000")
  await expect(row).toContainText("الصندوق")
  const number = await row.getAttribute("data-expense")

  // The drawer lists it as cash out (open day, or after today's close).
  await page.goto("/billing/cash")
  const movements = page.locator(`[data-movement="${number}"]`).filter({ visible: true })
  await expect(movements).toHaveCount(1)
  await expect(movements).toContainText("مصروف")
  await expect(movements).toContainText(/−\W?25,000/)

  // Voiding it needs a reason; the cash comes back and the entry is reversed.
  await page.goto("/accounting")
  await row.getByRole("button", { name: `إلغاء المصروف ${number}` }).click()
  const confirm = page.getByRole("alertdialog")
  await confirm.getByRole("button", { name: `إلغاء المصروف ${number}` }).click()
  await expect(confirm).toContainText("هذا الحقل مطلوب")
  await confirm.getByLabel("سبب الإلغاء").fill("سُجّل مرتين")
  await confirm.getByRole("button", { name: `إلغاء المصروف ${number}` }).click()
  await expect(page.getByText(`تم إلغاء المصروف ${number}`)).toBeVisible()
  await expect(row).toContainText("ملغى")
  // The drawer gets the 25,000 back.
  await page.goto("/billing/cash")
  await expect(movements).toHaveCount(2)
  await expect(movements.filter({ hasText: "مصروف ملغى" })).toContainText(/\+\W?25,000/)

  const [entries] = await query<{ posted: string; reversed: string }>(
    `select count(*) filter (where j.reverses_id is null) as posted,
            count(*) filter (where j.reverses_id is not null) as reversed
     from journal_entry j join expense e
       on j.id = e.journal_entry_id or j.reverses_id = e.journal_entry_id
     where e.number = $1`,
    [number],
  )
  expect(entries).toEqual({ posted: "1", reversed: "1" })
})

test("expenses can't be edited or deleted, and reception can't open the accounts", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  const [expense] = await query<{ id: string }>("select id from expense limit 1")
  test.skip(!expense, "needs an expense from the test above")
  await expect(
    query("update expense set amount = 1 where id = $1", [expense!.id]),
  ).rejects.toThrow()
  await expect(query("delete from expense where id = $1", [expense!.id])).rejects.toThrow()
  await expect(
    query(
      `insert into expense (id, number, account_id, method, amount, paid_on, description, idempotency_key)
       select gen_random_uuid(), 'EX-TEST', id, 'cash', 1, current_date, 'x', gen_random_uuid()
       from ledger_account where code = '1000'`,
    ),
  ).rejects.toThrow() // only expense accounts

  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("link", { name: "الحسابات" })).toHaveCount(0)
  await page.goto("/accounting")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

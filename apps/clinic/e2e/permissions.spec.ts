import { expect, test } from "@playwright/test"

import { login, loginAsOwner, query, RECEPTION } from "./fixtures"

test("the owner decides who may discount and void", async ({ page }, testInfo) => {
  // Desktop and phone change different switches, so they can run side by side.
  const desktop = testInfo.project.name === "desktop"
  const section = desktop ? "منح الخصم" : "إلغاء الفواتير"
  const permission = desktop ? "billing:discount" : "billing:void"
  const role = desktop
    ? { label: "استقبال", name: "reception" }
    : { label: "محاسب", name: "accountant" }

  await loginAsOwner(page)
  await page.goto("/settings")
  await page.getByRole("link", { name: "الصلاحيات" }).click()
  await expect(page).toHaveURL(/\/settings\/permissions$/)

  // Defaults: admin may discount, only the owner voids.
  const discount = page.getByRole("region", { name: "منح الخصم" })
  const voids = page.getByRole("region", { name: "إلغاء الفواتير" })
  await expect(discount.getByRole("switch", { name: "مدير" })).toBeChecked()
  await expect(voids.getByRole("switch", { name: "مدير" })).not.toBeChecked()
  await expect(discount).toContainText("دائماً") // the owner, not switchable
  await expect(discount.getByRole("switch", { name: "طبيب أسنان" })).toHaveCount(0) // can't invoice

  // Grant it, and it sticks.
  const target = page
    .getByRole("region", { name: section })
    .getByRole("switch", { name: role.label })
  await expect(target).not.toBeChecked()
  await target.click()
  await expect(page.getByText(`أصبح بإمكان دور «${role.label}» استخدام هذه الصلاحية`)).toBeVisible()
  await page.reload()
  await expect(target).toBeChecked()
  let rows = await query<{ granted: boolean }>(
    "select granted from role_permission where role = $1 and permission = $2",
    [role.name, permission],
  )
  expect(rows).toEqual([{ granted: true }])

  // Back to the default: the override row is removed, and both changes are audited.
  await target.click()
  await expect(
    page.getByText(`لم يعد بإمكان دور «${role.label}» استخدام هذه الصلاحية`),
  ).toBeVisible()
  await expect(async () => {
    rows = await query("select granted from role_permission where role = $1 and permission = $2", [
      role.name,
      permission,
    ])
    expect(rows).toEqual([])
  }).toPass()
  const audit = await query(
    "select 1 from audit_log where entity = 'role_permission' and entity_id = $1",
    [`${role.name}:${permission}`],
  )
  expect(audit.length).toBeGreaterThanOrEqual(2)
})

test("only the owner sees the permissions page", async ({ page }) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/settings/permissions")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

test("the ledger refuses unbalanced or edited journal entries", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "database check; one run is enough")

  const entry = async (debit: number, credit: number) => {
    const id = crypto.randomUUID()
    return query(`
      begin;
      insert into journal_entry (id, date, description, source_type)
        values ('${id}', current_date, 'e2e', 'manual');
      insert into journal_line (id, entry_id, account_id, debit)
        select gen_random_uuid(), '${id}', id, ${debit} from ledger_account where code = '1000';
      insert into journal_line (id, entry_id, account_id, credit)
        select gen_random_uuid(), '${id}', id, ${credit} from ledger_account where code = '4000';
      commit;
    `).then(() => id)
  }

  // Debits must equal credits (checked when the transaction commits).
  await expect(entry(1000, 900)).rejects.toThrow(/not balanced/)

  // A balanced entry is accepted, and from then on it can't be changed or deleted.
  const id = await entry(1000, 1000)
  await expect(
    query(`update journal_line set debit = 5 where entry_id = $1 and debit > 0`, [id]),
  ).rejects.toThrow(/append-only/)
  await expect(query(`delete from journal_entry where id = $1`, [id])).rejects.toThrow(
    /append-only/,
  )
  const [row] = await query<{ number: string }>("select number from journal_entry where id = $1", [
    id,
  ])
  expect(row?.number).toMatch(/^JE-\d{6}$/)
})

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

async function addDentist(
  page: Page,
  dentist: { name: string; username: string; password: string },
) {
  await page.goto("/settings/users")
  await page.getByRole("button", { name: "إضافة مستخدم" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الاسم").fill(dentist.name)
  await dialog.getByLabel("اسم المستخدم").fill(dentist.username)
  await dialog.getByLabel("الصلاحية").click()
  await page.getByRole("option", { name: "طبيب أسنان" }).click()
  await dialog.getByLabel("كلمة المرور", { exact: true }).fill(dentist.password)
  await dialog.getByLabel("تأكيد كلمة المرور").fill(dentist.password)
  await dialog.getByRole("button", { name: "إضافة مستخدم" }).click()
  await expect(page.getByText("تمت إضافة المستخدم")).toBeVisible()
}

test("a dentist's commission follows what patients pay for their work", async ({
  page,
}, testInfo) => {
  const desktop = testInfo.project.name === "desktop"
  const dentist = {
    name: `د. عمولة ${testInfo.project.name}`,
    username: `commission_${testInfo.project.name}`,
    password: "steady-river-58",
  }
  await loginAsOwner(page)
  await addDentist(page, dentist)

  // Pay isn't set yet; the owner sets 30% commission from this month.
  await page.goto("/hr")
  const row = page.locator("[data-testid=commission] tbody tr").filter({ hasText: dentist.name })
  await expect(row).toContainText("لم تُحدَّد طريقة الدفع")
  await row.getByRole("button", { name: `طريقة دفع ${dentist.name}` }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("نسبة العمولة (٪)").fill("٣٠") // Arabic digits
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم حفظ طريقة الدفع")).toBeVisible()
  await expect(row).toContainText("عمولة 30٪")
  await expect(row.getByTestId("commission-amount")).toHaveText(/^\D*0\D*$/)

  // A 400,000 treatment done by this dentist, invoiced, half paid.
  await createPatient(page, `مريض عمولة ${testInfo.project.name}`, uniquePhone(desktop ? 191 : 192))
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await query(
    `with plan as (
       insert into treatment_plan (id, patient_id, title, status, updated_at)
       values (gen_random_uuid(), $1, 'خطة العمولة', 'accepted', now()) returning id)
     insert into treatment_plan_item
       (id, plan_id, procedure_id, tooth, surfaces, price, currency, status, completed_at, dentist_id, updated_at)
     select gen_random_uuid(), plan.id, p.id, 36, '{}', 400000, 'IQD', 'done', now(), u.id, now()
     from plan, procedure p, "user" u
     where p.name like 'تاج زيركون%' and u.username = $2`,
    [patientUrl.split("/").pop(), dentist.username],
  )
  await page.goto(`${patientUrl}/billing`)
  await page.getByRole("button", { name: "فاتورة جديدة" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "إصدار الفاتورة" }).click()
  await expect(page).toHaveURL(/\/billing\/[0-9a-f-]{36}$/)
  await page.getByRole("button", { name: "تسجيل دفعة" }).click()
  await page.getByRole("dialog").getByLabel("المبلغ (دينار)").fill("200000")
  await page.getByRole("dialog").getByRole("radio", { name: /نقداً/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "تسجيل الدفعة" }).click()
  await expect(page.getByText(/تم تسجيل الدفعة/).first()).toBeVisible()

  // 30% of the 200,000 collected.
  await page.goto("/hr")
  await expect(row).toContainText("200,000")
  await expect(row.getByTestId("commission-amount")).toHaveText(/60,000/)
  await row.getByRole("link", { name: dentist.name }).click()
  await expect(page.getByTestId("commission-lines")).toContainText(
    `مريض عمولة ${testInfo.project.name}`,
  )
  await expect(page.getByTestId("commission-lines")).toContainText("200,000")

  // The dentist sees their own commission only, and can't change their pay.
  await page.context().clearCookies()
  await login(page, dentist.username, dentist.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  // The sidebar is folded away on a phone.
  if (desktop) await expect(page.getByRole("link", { name: "الموظفون" })).toBeVisible()
  await page.goto("/hr")
  await expect(page.locator("[data-testid=commission] tbody tr")).toHaveCount(1)
  await expect(page.getByTestId("commission-amount")).toHaveText(/60,000/)
  await expect(page.getByRole("button", { name: /طريقة دفع/ })).toHaveCount(0)
})

test("reception can't open staff pay, and pay history can't be edited", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("link", { name: "الموظفون" })).toHaveCount(0)
  await page.goto("/hr")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()

  const [pay] = await query<{ id: string }>("select id from dentist_pay limit 1")
  test.skip(!pay, "needs the pay set in the test above")
  await expect(
    query("update dentist_pay set commission_rate = 90 where id = $1", [pay!.id]),
  ).rejects.toThrow()
  await expect(
    query(
      `insert into dentist_pay (id, dentist_id, pay_type, commission_rate, effective_from)
       select gen_random_uuid(), dentist_id, 'commission', 30, date '2026-10-15' from dentist_pay limit 1`,
    ),
  ).rejects.toThrow() // a version starts on the 1st of a month
})

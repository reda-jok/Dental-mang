import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, query, RECEPTION } from "./fixtures"

const panels = (page: Page) => page.locator("[data-wide]")

async function openCustomize(page: Page) {
  await page.getByRole("button", { name: "تخصيص اللوحة" }).click()
  return page.getByRole("dialog")
}

test("a user hides, reorders and resets their own dashboard", async ({ page }) => {
  await loginAsOwner(page)
  await expect(page.locator("[data-widget=calendar]")).toBeVisible()
  const firstBefore = await panels(page).first().getAttribute("data-widget")

  // Hide the calendar and move today's appointments to the top of the panels.
  let dialog = await openCustomize(page)
  await dialog.getByLabel("إظهار تقويم المواعيد").click()
  const up = dialog.getByRole("button", { name: "تحريك مواعيد اليوم للأعلى" })
  while (await up.isEnabled()) await up.click()
  await expect(dialog.locator("[data-group=wide] [data-widget-row]").first()).toHaveAttribute(
    "data-widget-row",
    "todayAppointments",
  )
  await dialog.getByRole("button", { name: "حفظ الترتيب" }).click()
  await expect(page.getByText("تم حفظ ترتيب لوحتك")).toBeVisible()
  await expect(page.locator("[data-widget=calendar]")).toHaveCount(0)
  await expect(panels(page).first()).toHaveAttribute("data-widget", "todayAppointments")

  // It survives a reload; reset brings the default back.
  await page.reload()
  await expect(page.locator("[data-widget=calendar]")).toHaveCount(0)
  dialog = await openCustomize(page)
  await dialog.getByRole("button", { name: "الرجوع للافتراضي" }).click()
  await expect(page.getByText("عادت لوحتك إلى الترتيب الافتراضي")).toBeVisible()
  await expect(page.locator("[data-widget=calendar]")).toBeVisible()
  await expect(panels(page).first()).toHaveAttribute("data-widget", firstBefore!)
})

test("the owner sets reception's default; reception never sees clinical widgets", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "changes a shared role default")
  await query("delete from dashboard_layout where role is not null")

  await loginAsOwner(page)
  const dialog = await openCustomize(page)
  await dialog.getByLabel("إظهار إجمالي المرضى").click() // hidden in the default
  await dialog.getByLabel("الترتيب الافتراضي لدور").click()
  await page.getByRole("option", { name: "استقبال" }).click()
  await dialog.getByRole("button", { name: "حفظ هذا الترتيب كافتراضي" }).click()
  await expect(page.getByText("تم حفظ الترتيب الافتراضي لدور استقبال")).toBeVisible()
  // The owner's own dashboard didn't change.
  await expect(page.locator("[data-widget=totalPatients]")).toBeVisible()

  await page.context().clearCookies()
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator("[data-widget=todayCount]")).toBeVisible()
  await expect(page.locator("[data-widget=totalPatients]")).toHaveCount(0)
  // Not allowed for reception, whatever the default says.
  await expect(page.locator("[data-widget=treatmentValue]")).toHaveCount(0)
  await expect(page.locator("[data-widget=openPlans]")).toHaveCount(0)
  await page.getByRole("button", { name: "تخصيص اللوحة" }).click()
  await expect(page.getByRole("dialog").getByText("قيمة العلاجات المنجزة")).toHaveCount(0)
  await expect(page.getByRole("dialog").getByText("الترتيب الافتراضي لدور")).toHaveCount(0)

  await query("delete from dashboard_layout where role is not null")
})

/** "1250000.00" → "1,250,000", as the cards show dinars. */
const dinars = (amount: string) => Math.round(Number(amount)).toLocaleString("en-US")

test("the money cards match the books and open their pages", async ({ page }) => {
  await loginAsOwner(page)
  const [books] = await query<{
    today: string
    payments: string
    month: string
    overdue: string
    late: string
    owed: string
    labs: string
  }>(`
    with d as (select (now() at time zone 'Asia/Baghdad')::date as today),
    open as (
      select i.patient_id, i.due_date, i.total - coalesce((
        select sum(a.amount) from payment_allocation a join payment p on p.id = a.payment_id
        where a.invoice_id = i.id and p.voided_at is null), 0) as left_to_pay
      from invoice i where i.status = 'issued')
    select
      (select coalesce(sum(amount), 0) from payment, d where voided_at is null and received_on = d.today)
        - (select coalesce(sum(amount), 0) from refund, d where refunded_on = d.today) as today,
      (select count(*) from payment, d where voided_at is null and received_on = d.today) as payments,
      (select coalesce(sum(amount), 0) from payment, d
        where voided_at is null and received_on >= date_trunc('month', d.today))
        - (select coalesce(sum(amount), 0) from refund, d
        where refunded_on >= date_trunc('month', d.today)) as month,
      (select coalesce(sum(left_to_pay), 0) from open, d where left_to_pay > 0 and due_date < d.today) as overdue,
      (select count(distinct patient_id) from open, d where left_to_pay > 0 and due_date < d.today) as late,
      (select coalesce(sum(left_to_pay), 0) from open where left_to_pay > 0) as owed,
      (select coalesce(sum(l.credit - l.debit), 0) from journal_line l
        join ledger_account a on a.id = l.account_id where a.code = '2000') as labs`)
  await page.reload()

  const card = (key: string) => page.locator(`[data-widget=${key}]`)
  await expect(card("collected")).toContainText(dinars(books!.today))
  await expect(card("collected")).toContainText(dinars(books!.month))
  await expect(card("owedByPatients")).toContainText(dinars(books!.overdue))
  await expect(card("owedByPatients")).toContainText(dinars(books!.owed))
  await expect(card("owedByPatients")).toContainText(books!.late)
  // What's owed to labs equals the payables in the ledger.
  await expect(card("owedToLabs")).toContainText(dinars(books!.labs))

  // The drawer card shows the cash page's expected amount.
  const drawer = (await card("cashDrawer").innerText()).match(/[\d,]+(?=\s*د\.ع)/)![0]
  await card("cashDrawer").click()
  await expect(page).toHaveURL(/\/billing\/cash$/)
  await expect(page.getByText(drawer).first()).toBeVisible()
  await page.goto("/dashboard")
  await card("owedByPatients").click()
  await expect(page).toHaveURL(/\/billing\/debts$/)

  // Reception handles money but doesn't pay labs (unless the owner allows it).
  await page.context().clearCookies()
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(card("collected")).toBeVisible()
  await expect(card("cashDrawer")).toBeVisible()
  await expect(card("owedToLabs")).toHaveCount(0)
})

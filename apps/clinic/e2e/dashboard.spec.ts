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

test("the clinic statistics match the appointments and treatments", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "adds past visits; one run is enough")
  await loginAsOwner(page)
  // Three past visits on the last open day (not a Friday): two finished, one missed.
  await createPatient(page, "مريض إحصاءات اللوحة", uniquePhone(187))
  await expectCreated(page)
  const patient = { id: new URL(page.url()).pathname.split("/").pop()! }
  await query(
    `with d as (
       select day::date as day from generate_series((now() at time zone 'Asia/Baghdad')::date - 7,
                                       (now() at time zone 'Asia/Baghdad')::date - 1, '1 day') day
       where extract(dow from day) <> 5 order by day desc limit 1)
     insert into appointment (id, patient_id, starts_at, ends_at, status, created_at, updated_at)
     select gen_random_uuid(), $1, (d.day + time '16:00') at time zone 'Asia/Baghdad',
            (d.day + time '16:30') at time zone 'Asia/Baghdad', s::"AppointmentStatus", now(), now()
     from d, unnest(array['completed', 'completed', 'no_show']) s`,
    [patient!.id],
  )
  const [stats] = await query<{ no_show: string | null; top: string | null; busy: string }>(`
    with d as (select (now() at time zone 'Asia/Baghdad')::date as today),
    month as (
      select a.status from appointment a, d
      where a.starts_at >= (date_trunc('month', d.today)::timestamp at time zone 'Asia/Baghdad')
        and a.starts_at < now())
    select
      (select round(100.0 * count(*) filter (where status = 'no_show')
        / nullif(count(*) filter (where status in ('completed', 'no_show')), 0)) from month) as no_show,
      (select pr.name from treatment_plan_item i join procedure pr on pr.id = i.procedure_id, d
        where i.status = 'done'
          and i.completed_at >= (date_trunc('month', d.today)::timestamp at time zone 'Asia/Baghdad')
        group by pr.id, pr.name order by count(*) desc, sum(i.price - i.discount) desc limit 1) as top,
      (select count(*) from appointment a, d
        where a.status <> 'cancelled'
          and a.starts_at >= ((d.today - 90)::timestamp at time zone 'Asia/Baghdad')
          and a.starts_at < (d.today::timestamp at time zone 'Asia/Baghdad')
          and extract(dow from a.starts_at at time zone 'Asia/Baghdad') <> 5
          -- the grid covers opening hours only
          and extract(hour from a.starts_at at time zone 'Asia/Baghdad')
            between (select day_start_minutes / 60 from clinic_settings)
            and (select ceil(day_end_minutes / 60.0) - 1 from clinic_settings)) as busy`)
  await page.goto("/dashboard")

  const card = (key: string) => page.locator(`[data-widget=${key}]`)
  if (stats!.no_show !== null) await expect(card("attendance")).toContainText(`${stats!.no_show}`)
  if (stats!.top) {
    await expect(card("topProcedures").locator("li").first()).toContainText(stats!.top)
  }
  // Every booked visit of the last 90 days lands in exactly one cell.
  const cells = card("busyHours").locator("button[data-count]")
  const counts = await cells.evaluateAll((l) => l.map((e) => Number(e.getAttribute("data-count"))))
  expect(counts.reduce((a, b) => a + b, 0)).toBe(Number(stats!.busy))
  if (Number(stats!.busy) > 0) {
    // Tap (or hover) shows the count: needed on tablets.
    const busiest = cells.nth(counts.indexOf(Math.max(...counts)))
    await busiest.click()
    await expect(page.getByRole("tooltip")).toContainText(/موعد|مواعيد/)
  }
})

import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, newPatientWithPlan, query, RECEPTION } from "./fixtures"

/** Next keeps pages visited earlier in the document, hidden: only look at the one on screen. */
const shown = (page: Page, selector: string) => page.locator(selector).filter({ visible: true })

test("an open plan with no next visit is on the call list, with a WhatsApp follow-up, until a visit is booked", async ({
  page,
}, testInfo) => {
  const name = `مريض المتابعة ${testInfo.project.name}`
  await loginAsOwner(page)
  const patientUrl = await newPatientWithPlan(
    page,
    name,
    testInfo.project.name === "phone" ? 241 : 240,
  )
  const patientId = patientUrl.split("/").pop()!

  // Open plans: two of three done, the implant still to do.
  await page.goto(`/treatments?q=${encodeURIComponent(name)}`)
  const plan = shown(page, "[data-plan]").filter({ hasText: name })
  await expect(plan).toHaveCount(1)
  await expect(plan).toContainText("2 من 3")

  // Nothing booked: it's on the call list, and the message names the next step.
  await page.goto(`/treatments/call?q=${encodeURIComponent(name)}`)
  const call = shown(page, "[data-plan]").filter({ hasText: name })
  await expect(call).toContainText("زرعة")
  await call.getByRole("button", { name: `مراسلة ${name} عبر واتساب` }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText("متابعة خطة العلاج")
  await expect(dialog.getByRole("textbox")).toHaveValue(/الخطوة القادمة:\* زرعة/)
  await page.keyboard.press("Escape")

  // A visit booked for later takes it off the list.
  await query(
    `insert into appointment (id, patient_id, starts_at, ends_at, status, updated_at)
     select gen_random_uuid(), $1, t, t + interval '30 minutes', 'pending', now()
     from (select date_trunc('minute', now()) + interval '40 days'
                  + (floor(random() * 5000) * interval '1 minute') as t) s`,
    [patientId],
  )
  await page.reload()
  await expect(shown(page, "[data-testid=plans-to-call]").filter({ hasText: name })).toHaveCount(0)

  // The reports: the fillings done today (no dentist on them), and the implant still to do.
  await page.goto("/treatments/work")
  await expect(page.getByTestId("work-by-dentist").filter({ visible: true })).toContainText(
    "بدون طبيب",
  )
  await page.goto("/treatments/todo")
  await expect(page.getByText("المتبقي في الخطط المقبولة")).toBeVisible()
  await expect(page.getByTestId("todo-by-category").filter({ visible: true })).toBeVisible()
})

test("reception has the lists to call from, not the reports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole("link", { name: "العلاجات" }).first().click()
  await expect(page).toHaveURL(/\/treatments$/)
  await expect(page.getByRole("link", { name: "للاتصال" })).toBeVisible()
  await expect(page.getByRole("link", { name: "عمل الأطباء" })).toHaveCount(0)
  await page.goto("/treatments/work")
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

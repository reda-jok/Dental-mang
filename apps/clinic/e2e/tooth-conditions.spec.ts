import { expect, test } from "@playwright/test"

import { createPatient, expectCreated, loginAsOwner, query, uniquePhone } from "./fixtures"

test("the clinic adds its own tooth condition, records it, then hides it", async ({
  page,
}, testInfo) => {
  const name = `خراج ${testInfo.project.name}`
  await loginAsOwner(page)

  // Settings → Tooth conditions: the built-in ones are listed; add a whole-tooth problem.
  await page.goto("/settings/conditions")
  // Pages stream in: for a moment a hidden copy can exist, so look at the visible one.
  await expect(page.locator("[data-condition-row='تسوس']").filter({ visible: true })).toBeVisible()
  await page.getByRole("button", { name: "إضافة حالة" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الاسم").fill(name)
  await dialog.getByRole("radio", { name: "أرجواني" }).click()
  await dialog.getByLabel("السن كاملاً").check()
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تمت إضافة الحالة")).toBeVisible()
  await expect(page.locator(`[data-condition-row='${name}']`)).toContainText("مشكلة تحتاج علاجاً")

  // It's offered on the chart and drawn as a problem.
  await createPatient(
    page,
    `مريض الحالات ${testInfo.project.name}`,
    uniquePhone(testInfo.project.name === "desktop" ? 193 : 194),
  )
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await page.goto(`${patientUrl}/chart`)
  await page.getByTestId("chart-tools").getByRole("button", { name }).click()
  await page.locator('[data-tooth="11"]').click()
  await expect(page.getByText(`تم تسجيل ${name} على السن 11`)).toBeVisible()
  await expect(page.locator('[data-tooth="11"]')).toHaveAttribute("data-problem", "true")
  await expect(page.getByTestId("needs-treatment")).toContainText(name)

  // Hidden: no longer offered, but tooth 11 keeps it.
  await page.goto("/settings/conditions")
  await page.getByRole("button", { name: `إخفاء ${name}` }).click()
  await expect(page.getByText("تم إخفاء الحالة")).toBeVisible()
  await page.goto(`${patientUrl}/chart`)
  await expect(page.getByTestId("needs-treatment").filter({ visible: true })).toContainText(name)
  await expect(page.getByTestId("chart-tools").getByRole("button", { name })).toHaveCount(0)
})

test("the database keeps conditions: never deleted, meaning never changed", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  await expect(query("delete from tooth_condition where code = 'caries'")).rejects.toThrow()
  await expect(
    query("update tooth_condition set kind = 'existing' where code = 'caries'"),
  ).rejects.toThrow()
  await expect(
    query(
      "insert into tooth_condition (code, color, scope, kind, updated_at) values ('x', '#dc2626', 'tooth', 'problem', now())",
    ),
  ).rejects.toThrow() // a clinic condition needs a name
})

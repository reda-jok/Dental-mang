import { expect, test, type Page } from "@playwright/test"

import { createPatient, expectCreated, loginAsOwner, OWNER, query, uniquePhone } from "./fixtures"

// A 1×1 PNG: enough to stand for a clinic logo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

async function onePage(page: Page) {
  await page.emulateMedia({ media: "print" })
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1)
  await page.emulateMedia({ media: "screen" })
}

async function setReceiptPaper(page: Page, paper: "A5 (نصف صفحة)" | "طابعة إيصالات 80 مم") {
  await page.goto("/settings/clinic")
  await page.getByLabel("ورق إيصالات الدفع").click()
  await page.getByRole("option", { name: paper }).click()
  await page.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم الحفظ")).toBeVisible()
}

test("the clinic logo and the dentist's speciality print on prescriptions; receipts on A5 or 80 mm", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "clinic settings are shared: one run is enough")
  await loginAsOwner(page)

  // Settings → Clinic: the logo.
  await page.goto("/settings/clinic")
  await page
    .getByTestId("logo-input")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG })
  await expect(page.getByText("تم حفظ الشعار")).toBeVisible()
  await expect(page.getByRole("img", { name: "شعار العيادة" })).toBeVisible()

  // The owner's speciality and English name, from the employee form.
  await page.goto("/hr")
  const row = page.getByRole("row").filter({ hasText: OWNER.name }).filter({ visible: true })
  await row.getByRole("button", { name: "تعديل الاسم والصلاحية" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.locator("#speciality").fill("طبيب أسنان عام")
  await dialog.locator("#nameEn").fill("Dr. Ali")
  await dialog.locator("#specialityEn").fill("General Dentist")
  await dialog.getByRole("button", { name: "حفظ" }).click()
  await expect(page.getByText("تم تحديث الموظف")).toBeVisible()

  // A prescription: the dentist in Arabic and English, the logo, the stamp box, one page.
  await page.goto("/settings/medications")
  const load = page.getByRole("button", { name: "تحميل القائمة الجاهزة" })
  if (await load.isVisible()) await load.click()
  await expect(page.locator("[data-medication='Paracetamol 500 mg']")).toBeVisible()
  await createPatient(page, "مريض الطباعة المزدوجة", uniquePhone(195))
  await expectCreated(page)
  await page.goto(`${new URL(page.url()).pathname}/prescriptions`)
  await page.getByRole("button", { name: "وصفة جديدة" }).click()
  await page.getByRole("dialog").getByLabel("إضافة دواء").click()
  await page.getByRole("option", { name: "Paracetamol 500 mg" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "حفظ الوصفة" }).click()
  const [print] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "طباعة الوصفة" }).click(),
  ])
  const sheet = print.getByTestId("prescription")
  await expect(sheet.locator("header")).toContainText("طبيب أسنان عام")
  await expect(sheet.locator("header")).toContainText("Dr. Ali")
  await expect(sheet.locator("header")).toContainText("General Dentist")
  await expect(sheet.locator("header img")).toBeVisible()
  await expect(sheet).toContainText("الختم والتوقيع")
  await onePage(print)
  await print.close()

  // Receipts: A5 by default, the 80 mm receipt printer when chosen.
  const [payment] = await query<{ id: string }>(
    "select id from payment where voided_at is null order by created_at desc limit 1",
  )
  test.skip(!payment, "needs a payment from the billing tests")
  await page.goto(`/print/receipt/${payment!.id}`)
  await expect(page.getByTestId("receipt")).toBeVisible()
  await expect(page.locator("[data-paper=A5]")).toBeVisible()
  await onePage(page)
  await setReceiptPaper(page, "طابعة إيصالات 80 مم")
  await page.goto(`/print/receipt/${payment!.id}`)
  await expect(page.locator(".print-thermal")).toBeVisible()
  await expect(page.locator(".print-thermal img")).toBeVisible() // the logo
  await setReceiptPaper(page, "A5 (نصف صفحة)") // back to the default for the other tests
})

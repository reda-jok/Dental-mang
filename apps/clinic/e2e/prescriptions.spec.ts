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

async function ensureMedicines(page: Page) {
  await page.goto("/settings/medications")
  const load = page.getByRole("button", { name: "تحميل القائمة الجاهزة" })
  if (await load.isVisible()) {
    await load.click()
    await expect(page.getByText("تمت إضافة القائمة الجاهزة")).toBeVisible()
  }
  await expect(page.locator("[data-medication='Amoxicillin 500 mg']")).toBeVisible()
}

async function addMedicine(page: Page, name: string) {
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("إضافة دواء").click()
  await page.getByRole("option", { name }).click()
}

test("a prescription warns about the patient's allergy and prints on A5", async ({
  page,
}, testInfo) => {
  const name = `مريض وصفة ${testInfo.project.name}`
  await loginAsOwner(page)
  await ensureMedicines(page)
  await createPatient(page, name, uniquePhone(testInfo.project.name === "desktop" ? 141 : 142), [
    "البنسلين",
  ])
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname

  await page.goto(`${patientUrl}/prescriptions`)
  await page.getByRole("button", { name: "وصفة جديدة" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByTestId("medical-summary")).toContainText("البنسلين")

  // Amoxicillin for a penicillin-allergic patient: red warning, can't save unconfirmed.
  await addMedicine(page, "Amoxicillin 500 mg")
  await expect(dialog.locator("[data-warning=danger]")).toContainText("حساسية مسجّلة من البنسلين")
  await expect(dialog.getByRole("button", { name: "حفظ الوصفة" })).toBeDisabled()

  // Swap it for clindamycin; add a painkiller and a medicine written by hand.
  await dialog.getByRole("button", { name: "إزالة Amoxicillin 500 mg" }).click()
  await expect(dialog.locator("[data-warning]")).toHaveCount(0)
  await addMedicine(page, "Clindamycin 300 mg")
  await addMedicine(page, "Paracetamol 500 mg")
  await expect(dialog.getByLabel("الجرعة: Clindamycin 300 mg")).toHaveValue("كبسولة واحدة")
  await addMedicine(page, "دواء آخر (يُكتب يدوياً)")
  await expect(dialog.getByText("هذا الحقل مطلوب")).toHaveCount(0) // no error before typing
  await dialog.getByLabel("اسم الدواء", { exact: true }).fill("Cefixime 400 mg")
  await dialog.getByLabel("الجرعة: اسم الدواء").fill("حبة واحدة")
  await dialog.getByLabel("تعليمات عامة").fill("لا تأكل ولا تشرب لمدة ساعتين")
  await dialog.getByRole("button", { name: "حفظ الوصفة" }).click()

  // Saved; print it from the toast.
  const [print] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "طباعة الوصفة" }).click(),
  ])
  await expect(print.getByText("وصفة طبية")).toBeVisible()
  await expect(print.getByText(name)).toBeVisible()
  const items = print.getByTestId("prescription-items")
  await expect(items).toContainText("Clindamycin 300 mg")
  await expect(items).toContainText("Cefixime 400 mg")
  await expect(items).toContainText("لمدة 5 أيام")
  await expect(print.locator("[data-paper=A5]")).toBeVisible()
  await print.emulateMedia({ media: "print" })
  const pdf = await print.pdf({ preferCSSPageSize: true })
  expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1)
  await print.close()

  // On the patient's tab; and the dentist can confirm an allergy warning on purpose.
  await page.reload()
  await expect(page.locator("[data-prescription]")).toHaveCount(1)
  await page.getByRole("button", { name: "وصفة جديدة" }).click()
  await addMedicine(page, "Amoxicillin 500 mg")
  await dialog.getByLabel("اطلعت على تحذير الحساسية وأؤكد الوصفة على مسؤوليتي.").click()
  await dialog.getByRole("button", { name: "حفظ الوصفة" }).click()
  await expect(page.getByText("تم حفظ الوصفة")).toBeVisible()
  await expect(page.getByText("وُصفت رغم تحذير حساسية أكّده الطبيب.")).toBeVisible()
  const [row] = await query<{ acknowledged: string[] }>(
    `select acknowledged from prescription p join patient pt on pt.id = p.patient_id
     where pt.full_name = $1 and cardinality(acknowledged) > 0`,
    [name],
  )
  expect(row?.acknowledged).toEqual(["penicillin"])
})

test("reception can't open prescriptions", async ({ page }) => {
  const [patient] = await query<{ id: string }>("select id from patient limit 1")
  test.skip(!patient, "needs a patient")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/patients/${patient!.id}/prescriptions`)
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

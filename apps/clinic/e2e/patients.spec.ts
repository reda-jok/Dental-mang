import { expect, test } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  logout,
  NONE_DECLARED,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

// A valid 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
)

test("register a patient, find them by any spelling, and catch duplicates", async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === "desktop" ? "الجبوري" : "التميمي"
  const name = `فاطمة أحمد حسن ${suffix}`
  const phone = uniquePhone(testInfo.project.name === "desktop" ? 1 : 2)

  await loginAsOwner(page)
  await createPatient(page, name, phone)
  await expectCreated(page)
  await expect(page.getByRole("heading", { name })).toBeVisible()
  await expect(page.getByText(/^P-\d{6}$/).first()).toBeVisible()
  await expect(page.getByText("~34 سنة")).toBeVisible() // estimated age, shown with ~
  // "None declared" at intake → no medical alert, and no "not recorded" warning either.
  await expect(page.getByTestId("medical-alert")).toHaveCount(0)
  await expect(page.getByText("لم يُسجَّل التاريخ الطبي لهذا المريض بعد.")).toHaveCount(0)

  // Search ignores hamza/taa-marbuta differences and phone formatting.
  for (const q of [`فاطمه احمد ${suffix}`, phone.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3")]) {
    await page.goto(`/patients?q=${encodeURIComponent(q)}`)
    await expect(page.getByRole("link", { name }), q).toBeVisible()
  }

  // Same phone → duplicate warning; the user can still continue.
  await createPatient(page, `شخص آخر مختلف ${suffix}`, phone)
  await expect(page.getByText("قد يكون هذا المريض مسجلاً مسبقاً")).toBeVisible()
  await expect(page.getByRole("link", { name: "فتح الملف" })).toBeVisible()
  await page.getByRole("button", { name: "شخص مختلف، أنشئ ملفاً جديداً" }).click()
  await expectCreated(page)
})

test("medical history drives the red alert and refuses stale overwrites", async ({
  page,
  browser,
}, testInfo) => {
  await loginAsOwner(page)
  await createPatient(
    page,
    `مريض طبي ${testInfo.project.name}`,
    uniquePhone(testInfo.project.name === "desktop" ? 11 : 12),
  )
  await expectCreated(page)
  const medicalUrl = `${page.url()}/medical`

  // A second tab opens the same form before the first one saves.
  const other = await browser.newPage({ storageState: await page.context().storageState() })
  await other.goto(medicalUrl)

  await page.goto(medicalUrl)
  await page.getByLabel(NONE_DECLARED).uncheck()
  await page.getByLabel("البنسلين").check()
  await page.getByLabel("يتناول مميعات الدم").check()
  await page.getByRole("button", { name: "حفظ التاريخ الطبي" }).click()
  await expect(page.getByText("تم حفظ التاريخ الطبي")).toBeVisible()

  const alert = page.getByTestId("medical-alert")
  await expect(alert).toContainText("البنسلين")
  await expect(alert).toContainText("يتناول مميعات الدم")

  // The stale tab can't silently overwrite the newer version.
  await other.getByLabel(NONE_DECLARED).uncheck()
  await other.getByLabel("السكري").check()
  await other.getByRole("button", { name: "حفظ التاريخ الطبي" }).click()
  await expect(other.getByText("قام شخص آخر بتحديث التاريخ الطبي للتو")).toBeVisible()
  await other.close()
})

test("x-rays: upload by content type, served only to clinical staff", async ({
  page,
}, testInfo) => {
  await loginAsOwner(page)
  await createPatient(
    page,
    `مريض أشعة ${testInfo.project.name}`,
    uniquePhone(testInfo.project.name === "desktop" ? 21 : 22),
  )
  await expectCreated(page)
  const patientUrl = page.url()
  await page.goto(`${patientUrl}/files`)

  // A text file renamed to .png is rejected — the content decides, not the name.
  await page.getByRole("button", { name: "رفع صورة" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("الملف").setInputFiles({
    name: "xray.png",
    mimeType: "image/png",
    buffer: Buffer.from("<script>alert(1)</script>"),
  })
  await dialog.getByRole("button", { name: "رفع ملف" }).click()
  await expect(page.getByText("نوع الملف غير مدعوم")).toBeVisible()

  // Still in the dialog: choose the real image.
  await dialog
    .getByLabel("الملف")
    .setInputFiles({ name: "panoramic.png", mimeType: "image/png", buffer: PNG })
  await dialog.getByRole("button", { name: "رفع ملف" }).click()
  await expect(page.getByText("تم رفع الملف")).toBeVisible()
  await expect(dialog).toBeHidden()

  // The dashed tile opens the same upload dialog.
  await page.getByRole("button", { name: /اسحب صورة الأشعة هنا/ }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")

  const img = page.locator("img[src^='/api/attachments/']").first()
  await expect(img).toBeVisible()
  const fileUrl = (await img.getAttribute("src"))!

  const res = await page.request.get(fileUrl)
  expect(res.status()).toBe(200)
  expect(res.headers()["content-type"]).toBe("image/png")
  expect(res.headers()["x-content-type-options"]).toBe("nosniff")

  const [row] = await query<{ sha256: string; size_bytes: number }>(
    "select sha256, size_bytes from attachment where id = $1",
    [fileUrl.split("/").pop()],
  )
  expect(row?.size_bytes).toBe(PNG.length)
  expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/)

  // Reception: sees the patient, but not the clinical tabs or the file itself.
  await logout(page)
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(patientUrl)
  await expect(page.getByRole("link", { name: "الأشعة والملفات" })).toHaveCount(0)
  await expect(page.getByTestId("medical-alert")).toHaveCount(0)
  expect((await page.request.get(fileUrl)).status()).toBe(403)
  await page.goto(`${patientUrl}/files`)
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

test("uploads from another site are rejected (CSRF)", async ({ page }) => {
  await loginAsOwner(page)
  const res = await page.request.post("/api/uploads", {
    headers: { Origin: "https://evil.example" },
    multipart: {
      patientId: "00000000-0000-4000-8000-000000000000",
      kind: "xray",
      file: { name: "a.png", mimeType: "image/png", buffer: PNG },
    },
  })
  expect(res.status()).toBe(403)
})

test("archived patients disappear from search", async ({ page }, testInfo) => {
  const name = `مريض للأرشفة ${testInfo.project.name}`
  await loginAsOwner(page)
  await createPatient(page, name, uniquePhone(testInfo.project.name === "desktop" ? 31 : 32))
  await expectCreated(page)

  await page.getByRole("button", { name: "إخفاء المريض من القوائم (تبقى سجلاته محفوظة)" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "أرشفة المريض" }).click()
  await expect(page).toHaveURL(/\/patients$/)

  await page.goto(`/patients?q=${encodeURIComponent(name)}`)
  await expect(page.getByText(`لا توجد نتائج لـ «${name}»`)).toBeVisible()
})

test("phone, age and a medical answer are required", async ({ page }) => {
  await loginAsOwner(page)
  await page.goto("/patients/new")
  await page.getByLabel("الاسم الكامل").fill("مريض بلا بيانات")
  await page.getByLabel("ذكر").check()
  await page.getByRole("button", { name: "حفظ المريض" }).click()

  await expect(page.getByText("عمر غير صالح (0 إلى 120)")).toBeVisible()
  await expect(page.getByText("هذا الحقل مطلوب")).toBeVisible() // phone
  await expect(page.getByText("أجب عن التاريخ الطبي")).toBeVisible()
  await expect(page).toHaveURL(/\/patients\/new$/) // nothing was saved

  // "None" and a ticked item can't both be chosen: ticking "none" clears and locks the list.
  await page.getByLabel("السكري").check()
  await page.getByLabel(NONE_DECLARED).check()
  await expect(page.getByLabel("السكري")).not.toBeChecked()
  await expect(page.getByLabel("السكري")).toBeDisabled()
})

test("reception records the medical intake at registration but can't read it later", async ({
  page,
}, testInfo) => {
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await createPatient(
    page,
    `مريض استقبال ${testInfo.project.name}`,
    uniquePhone(testInfo.project.name === "desktop" ? 41 : 42),
    ["البنسلين"],
  )
  await expectCreated(page)
  const patientId = page.url().split("/").pop()

  // Stored as version 1, recorded by the receptionist.
  const [history] = await query<{ version: number; allergies: string[]; none_declared: boolean }>(
    "select version, allergies, none_declared from medical_history where patient_id = $1",
    [patientId],
  )
  expect(history).toEqual({ version: 1, allergies: ["penicillin"], none_declared: false })

  // …but reception can't open it afterwards.
  await expect(page.getByTestId("medical-alert")).toHaveCount(0)
  await page.goto(`/patients/${patientId}/medical`)
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

test("edit a patient's details", async ({ page }, testInfo) => {
  const seed = testInfo.project.name === "desktop" ? 61 : 62
  await loginAsOwner(page)
  await createPatient(page, `مريض للتعديل ${testInfo.project.name}`, uniquePhone(seed))
  await expectCreated(page)

  await page.getByRole("link", { name: "تعديل البيانات" }).click()
  const newName = `مريض معدل ${testInfo.project.name}`
  await page.getByLabel("الاسم الكامل").fill(newName)
  await page.getByLabel(/^الهاتف/).fill(uniquePhone(seed + 100))
  await page.getByRole("button", { name: "حفظ المريض" }).click()

  await expect(page.getByText("تم تحديث بيانات المريض")).toBeVisible()
  await expect(page.getByRole("heading", { name: newName })).toBeVisible()
  await page.goto(`/patients?q=${encodeURIComponent(newName)}`)
  await expect(page.getByRole("link", { name: newName })).toBeVisible()
})

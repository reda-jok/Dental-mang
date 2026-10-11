import { expect, test } from "@playwright/test"

import {
  createPatient,
  expectCreated,
  login,
  loginAsOwner,
  query,
  RECEPTION,
  uniquePhone,
} from "./fixtures"

/** A note written straight to the database, signed `hoursAgo` hours ago. */
async function seedNote(
  patientId: string,
  authorUsername: string,
  body: string,
  hoursAgo: number,
) {
  const [note] = await query<{ id: string }>(
    `insert into clinical_note (id, patient_id, author_id, visit_on, created_at)
     select gen_random_uuid(), $1, u.id,
            ((now() - make_interval(hours => $3)) at time zone 'Asia/Baghdad')::date,
            now() - make_interval(hours => $3)
     from "user" u where u.username = $2
     returning id`,
    [patientId, authorUsername, hoursAgo],
  )
  await query(
    `insert into clinical_note_version (id, note_id, version, body, written_by_id, created_at)
     select gen_random_uuid(), n.id, 1, $2, n.author_id, n.created_at from clinical_note n where n.id = $1`,
    [note!.id, body],
  )
  return note!.id
}

test("a dentist writes, corrects, amends and deletes visit notes", async ({ page }, testInfo) => {
  const name = `مريض ملاحظات ${testInfo.project.name}`
  await loginAsOwner(page)
  await createPatient(page, name, uniquePhone(testInfo.project.name === "desktop" ? 171 : 172))
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  const patientId = patientUrl.split("/").pop()!

  // Today's appointment (finished an hour in), and an old note that is locked by now.
  await query(
    `insert into appointment (id, patient_id, starts_at, ends_at, status, updated_at)
     values (gen_random_uuid(), $1,
       (date_trunc('day', now() at time zone 'Asia/Baghdad') + interval '1 minute') at time zone 'Asia/Baghdad',
       (date_trunc('day', now() at time zone 'Asia/Baghdad') + interval '31 minutes') at time zone 'Asia/Baghdad',
       'completed', now())`,
    [patientId],
  )
  await seedNote(patientId, "ali", "قلع 48 دون مضاعفات.", 72)
  await seedNote(patientId, RECEPTION.username, "ملاحظة كتبها مستخدم آخر.", 2)

  await page.getByRole("link", { name: "الملاحظات" }).click()
  await expect(page).toHaveURL(new RegExp(`${patientUrl}/notes$`))
  await expect(page.locator("[data-note]")).toHaveCount(2)

  // New note: linked to today's appointment by default; the text is required.
  await page.getByRole("button", { name: "ملاحظة جديدة" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel("الزيارة")).toContainText("الساعة")
  await dialog.getByRole("button", { name: "حفظ وتوقيع" }).click()
  await expect(dialog.getByText("هذا الحقل مطلوب")).toBeVisible()
  await dialog.getByLabel("الملاحظة").fill("ألم في 36.\nحشوة مؤقتة، والموعد القادم بعد أسبوع.")
  await dialog.getByRole("button", { name: "حفظ وتوقيع" }).click()
  await expect(page.getByText("تم حفظ الملاحظة")).toBeVisible()

  const fresh = page.locator("[data-note]").filter({ hasText: "ألم في 36." })
  await expect(fresh).toContainText("موعد الساعة")
  await expect(fresh.getByTestId("note-body")).toHaveText(
    "ألم في 36.\nحشوة مؤقتة، والموعد القادم بعد أسبوع.",
  )

  // Within 24 hours the author corrects it; the original stays in the history.
  await fresh.getByRole("button", { name: "تصحيح" }).click()
  await expect(dialog.getByRole("heading", { name: "تصحيح الملاحظة" })).toBeVisible()
  await dialog.getByLabel("الملاحظة").fill("ألم في 46.\nحشوة مؤقتة، والموعد القادم بعد أسبوع.")
  await dialog.getByRole("button", { name: "حفظ التغيير" }).click()
  await expect(page.getByText("تم حفظ التغيير")).toBeVisible()
  const corrected = page.locator("[data-note]").filter({ hasText: "ألم في 46." })
  await expect(corrected).toContainText("صُحّحت")
  await corrected.getByText("النسخ السابقة (1)").click()
  await expect(corrected.locator("[data-version='1']")).toContainText("ألم في 36.")

  // The old note is locked: no delete, and a change is a visible amendment.
  const old = page.locator("[data-note]").filter({ hasText: "قلع 48" })
  await expect(old).toContainText("مقفلة")
  await expect(old.getByRole("button", { name: "حذف الملاحظة" })).toBeDisabled()
  await old.getByRole("button", { name: "إضافة تعديل" }).click()
  await expect(dialog.getByRole("heading", { name: "تعديل ملاحظة مقفلة" })).toBeVisible()
  await dialog.getByLabel("الملاحظة").fill("قلع 48 دون مضاعفات.\n\nتعديل: لا تورم بعد يومين.")
  await dialog.getByRole("button", { name: "حفظ التغيير" }).click()
  await expect(page.getByText("تم حفظ التغيير")).toBeVisible()
  const amended = page.locator("[data-note]").filter({ hasText: "لا تورم بعد يومين" })
  await expect(amended.getByTestId("note-amended")).toBeVisible()
  await expect(amended.locator("[data-version='1']")).toHaveCount(1)

  // Someone else's note: view only.
  const theirs = page.locator("[data-note]").filter({ hasText: "مستخدم آخر" })
  await expect(theirs.getByRole("button", { name: "تصحيح" })).toBeDisabled()
  await expect(theirs.getByRole("button", { name: "حذف الملاحظة" })).toBeDisabled()

  // Delete today's note (e.g. written on the wrong patient).
  await corrected.getByRole("button", { name: "حذف الملاحظة" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "حذف الملاحظة" }).click()
  await expect(page.getByText("تم حذف الملاحظة")).toBeVisible()
  await expect(page.locator("[data-note]")).toHaveCount(2)

  // The database kept everything: the deleted note, and every version of the others.
  const [counts] = await query<{ deleted: string; versions: string }>(
    `select count(*) filter (where n.deleted_at is not null) as deleted,
            (select count(*) from clinical_note_version v join clinical_note n2 on n2.id = v.note_id
             where n2.patient_id = $1) as versions
     from clinical_note n where n.patient_id = $1`,
    [patientId],
  )
  expect(counts).toEqual({ deleted: "1", versions: "5" })
})

test("reception can't open visit notes", async ({ page }) => {
  const [patient] = await query<{ id: string }>("select id from patient limit 1")
  test.skip(!patient, "needs a patient")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/patients/${patient!.id}`)
  await expect(page.getByRole("link", { name: "الملاحظات" })).toHaveCount(0)
  await page.goto(`/patients/${patient!.id}/notes`)
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
})

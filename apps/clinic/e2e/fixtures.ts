import { expect, type Page, type TestInfo } from "@playwright/test"
import { Client } from "pg"

import { e2eDatabaseUrl } from "./database"

export const OWNER = {
  clinicName: "عيادة الابتسامة",
  name: "د. علي",
  username: "ali",
  password: "correct-horse-42",
}

export const RECEPTION = { name: "ريم", username: "reem", password: "sunny-window-31" }

export async function login(page: Page, username = OWNER.username, password = OWNER.password) {
  await page.goto("/login")
  await page.getByLabel("اسم المستخدم").fill(username)
  await page.getByLabel("كلمة المرور").fill(password)
  await page.getByRole("button", { name: "دخول" }).click()
}

export async function loginAsOwner(page: Page) {
  await login(page)
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function logout(page: Page) {
  await page.context().clearCookies()
}

/** Desktop and phone runs share one database; keep their records apart. */
export function unique(base: string, testInfo: TestInfo) {
  return `${base}_${testInfo.project.name}`
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: e2eDatabaseUrl() })
  await client.connect()
  try {
    return (await client.query(sql, params)).rows as T[]
  } finally {
    await client.end()
  }
}

/** Unique per project + test, as desktop and phone share one database. */
export function uniquePhone(seed: number) {
  return `0781${String(seed).padStart(7, "0")}`
}

export const NONE_DECLARED = "لا يعاني من أي أمراض أو حساسية، ولا يتناول أدوية"

/**
 * Fills and submits the form. Medical answer: "none" by default, or the given allergies.
 * Call `expectCreated` when no duplicate warning is expected.
 */
export async function createPatient(
  page: Page,
  name: string,
  phone: string,
  allergies: string[] = [],
) {
  await page.goto("/patients/new")
  await page.getByLabel("الاسم الكامل").fill(name)
  await page.getByLabel("أنثى").check()
  await page.getByLabel("العمر بالسنوات").fill("٣٤") // Arabic digits
  await page.getByLabel(/^الهاتف/).fill(phone)
  if (allergies.length === 0) await page.getByLabel(NONE_DECLARED).check()
  for (const allergy of allergies) await page.getByLabel(allergy).check()
  await page.getByRole("button", { name: "حفظ المريض" }).click()
}

/** Waits for the success toast AND the navigation to the new patient's page. */
export async function expectCreated(page: Page) {
  await expect(page.getByText("تمت إضافة المريض")).toBeVisible()
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/)
}

/**
 * A treatment plan for the patient, written straight to the database (charting has its
 * own tests): two fillings already done, an implant still planned.
 */
export async function seedPlan(patientId: string) {
  const [plan] = await query<{ id: string }>(
    `insert into treatment_plan (id, patient_id, title, status, updated_at)
     values (gen_random_uuid(), $1, 'خطة الفوترة', 'accepted', now()) returning id`,
    [patientId],
  )
  await query(
    `insert into treatment_plan_item
       (id, plan_id, procedure_id, tooth, surfaces, price, currency, status, completed_at, updated_at)
     select gen_random_uuid(), $1, p.id, t.tooth, '{}', p.price, 'IQD', t.status::"PlanItemStatus",
            case when t.status = 'done' then now() end, now()
     from (values ('حشوة تجميلية', 16, 'done'), ('حشوة تجميلية', 26, 'done'),
                  ('زرعة سنية', 36, 'planned')) as t(name, tooth, status)
     join procedure p on p.name like t.name || '%'`,
    [plan!.id],
  )
  return plan!.id
}

export async function newPatientWithPlan(page: Page, name: string, phoneSeed: number) {
  await createPatient(page, name, uniquePhone(phoneSeed))
  await expectCreated(page)
  const patientUrl = new URL(page.url()).pathname
  await seedPlan(patientUrl.split("/").pop()!)
  return patientUrl
}

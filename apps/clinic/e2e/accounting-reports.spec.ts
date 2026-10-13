import { expect, test, type Page } from "@playwright/test"

import { login, loginAsOwner, RECEPTION } from "./fixtures"

/** Next keeps pages visited earlier in the document, hidden: only look at the one on screen. */
const shown = (page: Page, selector: string) => page.locator(selector).filter({ visible: true })

/** A shown amount as whole dinars: "−1,234 د.ع." → -1234. */
async function dinars(page: Page, selector: string) {
  const text = await shown(page, selector).innerText()
  const value = Number(text.replace(/[^\d]/g, ""))
  return /[−-]/.test(text) ? -value : value
}

/** Records an expense paid by bank and returns its number. */
async function recordBankExpense(
  page: Page,
  category: string,
  amount: string,
  description: string,
) {
  await page.goto("/accounting")
  await page.getByRole("button", { name: "تسجيل مصروف" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("البند").click()
  await page.getByRole("option", { name: category }).click()
  await dialog.getByLabel("المبلغ (دينار)").fill(amount)
  await dialog.getByRole("radio", { name: "الحساب المصرفي" }).click()
  await dialog.getByLabel("الوصف").fill(description)
  if (category === "أجور الأطباء") await expect(dialog).toContainText("فلا تُحسب مرتين")
  await dialog.getByRole("button", { name: "تسجيل المصروف" }).click()
  const toast = page.getByText(/تم تسجيل المصروف EX-\d{4}-\d{6}/)
  await expect(toast).toBeVisible()
  return (await toast.innerText()).match(/EX-\d{4}-\d{6}/)![0]
}

const PROFIT = '[data-line="profit"] [data-month="current"]'

test("an expense lowers the month's profit and shows in the cash book; dentist pay isn't counted twice", async ({
  page,
}, testInfo) => {
  const tag = testInfo.project.name
  await loginAsOwner(page)
  await page.goto("/accounting")
  await page.getByRole("link", { name: "الأرباح والخسائر" }).click()
  await expect(page).toHaveURL(/\/accounting\/profit/)
  // Something in the books this month, so the statement shows.
  await recordBankExpense(page, "مصاريف أخرى", "5000", `قرطاسية ${tag}`)
  await page.goto("/accounting/profit")
  await expect(page.getByTestId("pnl").filter({ visible: true })).toBeVisible()
  const before = await dinars(page, PROFIT)

  const rent = await recordBankExpense(page, "الإيجار", "100000", `إيجار المخزن ${tag}`)
  await page.goto("/accounting/profit")
  await expect(shown(page, '[data-line="5400"]')).toContainText("الإيجار")
  expect(await dinars(page, PROFIT)).toBe(before - 100_000)
  await expect(
    page.getByTestId("profit-bars").filter({ visible: true }).getByRole("button"),
  ).toHaveCount(6)

  // Handing a dentist their pay moves money but not the profit (their pay is already counted).
  const pay = await recordBankExpense(page, "أجور الأطباء", "50000", `أجور ${tag}`)
  await page.goto("/accounting/profit")
  expect(await dinars(page, PROFIT)).toBe(before - 100_000)

  // The bank's cash book: both payments out, and the balance adds up.
  await page.goto("/accounting/cash-book")
  await page.getByRole("link", { name: "الحساب المصرفي" }).click()
  await expect(page).toHaveURL(/account=bank/)
  await expect(shown(page, `[data-movement="${rent}"]`)).toContainText(`إيجار المخزن ${tag}`)
  await expect(shown(page, `[data-movement="${rent}"]`)).toContainText("100,000")
  await expect(shown(page, `[data-movement="${pay}"]`)).toContainText("50,000")
  const total = (key: string) => dinars(page, `[data-total="${key}"] dd`)
  expect(await total("closing")).toBe(
    (await total("opening")) + (await total("moneyIn")) - (await total("moneyOut")),
  )

  // The revenue breakdown opens with its three lists (or their empty notes).
  await page.goto("/accounting/revenue")
  for (const title of ["حسب الطبيب", "حسب نوع العلاج", "المحصّل حسب طريقة الدفع"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
  }
})

test("reception can't open the financial reports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough")
  await login(page, RECEPTION.username, RECEPTION.password)
  await expect(page).toHaveURL(/\/dashboard$/)
  for (const path of ["/accounting/profit", "/accounting/cash-book", "/accounting/revenue"]) {
    await page.goto(path)
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible()
  }
})

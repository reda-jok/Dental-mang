import { describe, expect, it } from "vitest"

import {
  completedMessage,
  paymentReminderMessage,
  reminderMessage,
  scheduledMessage,
  whatsappLink,
} from "./whatsapp"

const base = {
  clinicName: "عيادة الابتسامة",
  patientName: "فاطمة",
  startsAt: new Date("2026-10-05T13:30:00Z"), // 16:30 in Baghdad
  dentistName: "د. علي",
  procedureName: "حشوة تجميلية",
}

describe("WhatsApp messages", () => {
  it("shows the time in the clinic's time zone, Iraqi style, with Western digits", () => {
    const text = scheduledMessage(base)
    expect(text).toContain("4:30")
    expect(text).toContain("م") // PM
    expect(text).toContain("2026")
    expect(text).not.toMatch(/[٠-٩]/)
    expect(text).toContain("عيادة الابتسامة")
    expect(text).toContain("د. علي")
  })

  it("drops lines for missing details", () => {
    const text = reminderMessage({ ...base, dentistName: null, procedureName: null })
    expect(text).not.toContain("الطبيب")
    expect(text).not.toContain("الإجراء")
    expect(text).toContain("تذكير")
  })

  it("completed message is Arabic only (the original appended English too)", () => {
    const text = completedMessage(base)
    expect(text).not.toMatch(/[A-Za-z]{3,}/)
    expect(text).toContain("حشوة تجميلية")
  })

  it("builds a wa.me link for an Iraqi number", () => {
    const link = whatsappLink("+9647701234567", "مرحباً")
    expect(link.startsWith("https://wa.me/9647701234567?text=")).toBe(true)
    expect(decodeURIComponent(link.split("text=")[1]!)).toBe("مرحباً")
  })
})

describe("payment reminder", () => {
  it("states the amount and since when, with Western digits", () => {
    const text = paymentReminderMessage({
      clinicName: "عيادة الابتسامة",
      patientName: "فاطمة",
      amount: "75,000 د.ع.",
      dueDate: "2026-08-15",
      clinicPhone: "0770 123 4567",
    })
    expect(text).toContain("تذكير بالدفع")
    expect(text).toContain("75,000 د.ع.")
    expect(text).toContain("15 أغسطس 2026")
    expect(text).toContain("0770 123 4567")
    expect(text).not.toMatch(/[٠-٩]/)
  })

  it("drops the date and phone lines when unknown", () => {
    const text = paymentReminderMessage({
      clinicName: "عيادة الابتسامة",
      patientName: "فاطمة",
      amount: "10,000 د.ع.",
    })
    expect(text).not.toContain("مستحق منذ")
    expect(text).not.toContain("للاستفسار")
  })
})

// WhatsApp messages (the clinic's original Arabic templates), sent with wa.me links:
// free, no API account, and no risk of the clinic's number being banned (decision D3).

export type WhatsAppKind = "scheduled" | "reminder" | "completed" | "payment" | "custom"

export type AppointmentMessage = {
  clinicName: string
  patientName: string
  startsAt: Date
  dentistName?: string | null
  procedureName?: string | null
  timeZone?: string
}

const LOCALE = "ar-u-nu-latn"
// Doctor emoji (man + ZWJ + medical symbol), written as escapes because it contains an invisible joiner.
const DOCTOR = "\u{1F468}\u200D\u2695\uFE0F"

function when(startsAt: Date, timeZone: string) {
  return {
    date: new Intl.DateTimeFormat(LOCALE, {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(startsAt),
    time: new Intl.DateTimeFormat(LOCALE, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startsAt),
  }
}

/** Optional lines are dropped when the value is missing. */
function lines(...parts: (string | false | null | undefined)[]) {
  return parts.filter((p): p is string => typeof p === "string").join("\n")
}

export function scheduledMessage(m: AppointmentMessage): string {
  const { date, time } = when(m.startsAt, m.timeZone ?? "Asia/Baghdad")
  return lines(
    `🦷 *${m.clinicName}* - تأكيد الموعد`,
    "",
    `مرحباً ${m.patientName}! 👋`,
    "تم تأكيد موعدك بنجاح:",
    "",
    `📅 *التاريخ:* ${date}`,
    `🕐 *الوقت:* ${time}`,
    m.dentistName && `${DOCTOR} *الطبيب:* ${m.dentistName}`,
    m.procedureName && `🔧 *الإجراء:* ${m.procedureName}`,
    "",
    "📍 يرجى الحضور قبل 15 دقيقة من الموعد.",
    "إذا كنت بحاجة لإعادة جدولة الموعد أو لديك أي استفسار، يرجى الاتصال بنا.",
    "",
    `شكراً لاختيارك ${m.clinicName}! 😊`,
  )
}

export function reminderMessage(m: AppointmentMessage): string {
  const { date, time } = when(m.startsAt, m.timeZone ?? "Asia/Baghdad")
  return lines(
    `🦷 *${m.clinicName}* - تذكير بالموعد`,
    "",
    `مرحباً ${m.patientName}! 👋`,
    "هذا تذكير ودي بموعدك القادم:",
    "",
    `📅 *التاريخ:* ${date}`,
    `🕐 *الوقت:* ${time}`,
    m.dentistName && `${DOCTOR} *الطبيب:* ${m.dentistName}`,
    m.procedureName && `🔧 *الإجراء:* ${m.procedureName}`,
    "",
    "📍 يرجى الحضور قبل 15 دقيقة من الموعد.",
    "إذا كنت بحاجة لإعادة الجدولة، يرجى الاتصال بنا في أقرب وقت ممكن.",
    "",
    "نراك قريباً! 😊",
  )
}

export function completedMessage(m: AppointmentMessage & { nextVisit?: Date | null }): string {
  const tz = m.timeZone ?? "Asia/Baghdad"
  return lines(
    `🦷 *${m.clinicName}* - اكتمال العلاج`,
    "",
    `مرحباً ${m.patientName}! 👋`,
    m.procedureName
      ? `تم إنجاز ${m.procedureName}${m.dentistName ? ` مع ${m.dentistName}` : ""} بنجاح! ✅`
      : "تمت زيارتك بنجاح! ✅",
    "شكراً لزيارتك اليوم. نتمنى أن تكون بأفضل حال! 😊",
    m.nextVisit && "",
    m.nextVisit &&
      `📅 *الموعد القادم:* ${when(m.nextVisit, tz).date}، ${when(m.nextVisit, tz).time}`,
    "",
    "إذا كان لديك أي استفسار، لا تتردد في التواصل معنا.",
    "اعتنِ بنفسك! 🌟",
  )
}

export type PaymentReminderMessage = {
  clinicName: string
  patientName: string
  /** Formatted amount, e.g. "75,000 د.ع." */
  amount: string
  /** Oldest unpaid due date (ISO), when something is past due. */
  dueDate?: string | null
  clinicPhone?: string | null
}

/** A polite reminder of money owed (debts page and the patient's billing tab). */
export function paymentReminderMessage(m: PaymentReminderMessage): string {
  const due =
    m.dueDate &&
    new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${m.dueDate}T00:00:00Z`))
  return lines(
    `🦷 *${m.clinicName}* - تذكير بالدفع`,
    "",
    `مرحباً ${m.patientName}! 👋`,
    "نود تذكيرك بلطف بوجود مبلغ مستحق على حسابك لدى العيادة:",
    "",
    `💰 *المبلغ المستحق:* ${m.amount}`,
    due && `📅 *مستحق منذ:* ${due}`,
    "",
    "يمكنك الدفع في العيادة نقداً أو بالبطاقة أو عبر المحفظة الإلكترونية.",
    m.clinicPhone && `📞 للاستفسار: ${m.clinicPhone}`,
    "",
    "إذا كنت قد سددت المبلغ مؤخراً، يرجى تجاهل هذه الرسالة. شكراً لك! 😊",
  )
}

/** wa.me link with the message filled in. `phone` is E.164 (+9647…). */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
}

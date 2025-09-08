// WhatsApp messaging utility functions with Arabic support
export interface WhatsAppMessage {
  to: string // Phone number in international format
  message: string
  type: "appointment_scheduled" | "appointment_completed" | "appointment_reminder" | "custom"
}

export class WhatsAppService {
  private static formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, "")

    // Add country code if not present (assuming US +1)
    if (cleaned.length === 10) {
      return `1${cleaned}`
    }

    // Remove leading 1 if present and re-add it
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return cleaned
    }

    return cleaned
  }

  static generateAppointmentScheduledMessage(
    patientName: string,
    date: string,
    time: string,
    procedure: string,
    dentist: string,
    clinicName = "DentalCare Pro",
    locale = "ar-SA",
  ): string {
    const formattedDate = new Date(date).toLocaleDateString(locale === "ar-SA" ? "ar-SA" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    if (locale === "ar-SA") {
      return `🦷 *${clinicName}* - تأكيد الموعد

مرحباً ${patientName}! 👋

تم تأكيد موعدك بنجاح:

📅 *التاريخ:* ${formattedDate}
🕐 *الوقت:* ${time}
👨‍⚕️ *الطبيب:* ${dentist}
🔧 *الإجراء:* ${procedure}

📍 يرجى الحضور قبل ١٥ دقيقة من الموعد.

إذا كنت بحاجة لإعادة جدولة الموعد أو لديك أي استفسارات، يرجى الاتصال بنا.

شكراً لاختيارك ${clinicName}! 😊`
    } else {
      return `🦷 *${clinicName}* - Appointment Scheduled

Hello ${patientName}! 👋

Your appointment has been successfully scheduled:

📅 *Date:* ${formattedDate}
🕐 *Time:* ${time}
👨‍⚕️ *Doctor:* ${dentist}
🔧 *Procedure:* ${procedure}

📍 Please arrive 15 minutes early for check-in.

If you need to reschedule or have any questions, please call us.

Thank you for choosing ${clinicName}! 😊`
    }
  }

  static generateAppointmentCompletedMessage(
    patientName: string,
    procedure: string,
    dentist: string,
    followUpInstructions?: string,
    nextAppointmentDate?: string,
    clinicName = "DentalCare Pro",
    locale = "ar-SA",
  ): string {
    let message = ""

    if (locale === "ar-SA") {
      message = `🦷 *${clinicName}* - اكتمال العلاج

مرحباً ${patientName}! 👋

تم إنجاز علاج ${procedure} مع ${dentist} بنجاح! ✅

شكراً لزيارتك اليوم. نتمنى أن تكون بأفضل حال! 😊`
    } else {
      message = `🦷 *${clinicName}* - Treatment Completed

Hello ${patientName}! 👋

Your ${procedure} treatment with ${dentist} has been completed successfully! ✅

Thank you for visiting us today. We hope you're feeling great! 😊`
    }

    if (followUpInstructions) {
      message += `\n\n📋 *Post-Treatment Care:*\n${followUpInstructions}`
      if (locale === "ar-SA") {
        message += `\n\n📋 *تعليمات ما بعد العلاج:*\n${followUpInstructions}`
      }
    }

    if (nextAppointmentDate) {
      const formattedDate = new Date(nextAppointmentDate).toLocaleDateString(locale === "ar-SA" ? "ar-SA" : "en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      message += `\n\n📅 *Next Appointment:* ${formattedDate}`
      if (locale === "ar-SA") {
        message += `\n\n📅 *الموعد القادم:* ${formattedDate}`
      }
    }

    message += `\n\nIf you have any concerns or questions, please don't hesitate to contact us.`
    if (locale === "ar-SA") {
      message += `\n\nإذا كان لديك أي مخاوف أو استفسارات، لا تتردد في التواصل معنا.`
    }

    message += `\n\nTake care! 🌟`
    if (locale === "ar-SA") {
      message += `\n\nاعتن بنفسك! 🌟`
    }

    return message
  }

  static generateAppointmentReminderMessage(
    patientName: string,
    date: string,
    time: string,
    procedure: string,
    dentist: string,
    clinicName = "DentalCare Pro",
    locale = "ar-SA",
  ): string {
    const formattedDate = new Date(date).toLocaleDateString(locale === "ar-SA" ? "ar-SA" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    if (locale === "ar-SA") {
      return `🦷 *${clinicName}* - تذكير بالموعد

مرحباً ${patientName}! 👋

هذا تذكير ودي بموعدك القادم:

📅 *التاريخ:* ${formattedDate}
🕐 *الوقت:* ${time}
👨‍⚕️ *الطبيب:* ${dentist}
🔧 *الإجراء:* ${procedure}

📍 يرجى الحضور قبل ١٥ دقيقة من الموعد.

إذا كنت بحاجة لإعادة الجدولة، يرجى الاتصال بنا في أقرب وقت ممكن.

نراك قريباً! 😊`
    } else {
      return `🦷 *${clinicName}* - Appointment Reminder

Hello ${patientName}! 👋

This is a friendly reminder about your upcoming appointment:

📅 *Date:* ${formattedDate}
🕐 *Time:* ${time}
👨‍⚕️ *Doctor:* ${dentist}
🔧 *Procedure:* ${procedure}

📍 Please arrive 15 minutes early for check-in.

If you need to reschedule, please call us as soon as possible.

See you soon! 😊`
    }
  }

  static async sendWhatsAppMessage(messageData: WhatsAppMessage): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(messageData.to)

      // In a real application, you would integrate with a WhatsApp Business API service
      // such as Twilio, WhatsApp Business API, or similar service

      // For demonstration, we'll use the WhatsApp Web URL method
      // This opens WhatsApp Web with the pre-filled message
      const encodedMessage = encodeURIComponent(messageData.message)
      const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`

      // Log the message for development
      console.log("WhatsApp Message:", {
        to: formattedPhone,
        message: messageData.message,
        url: whatsappUrl,
      })

      // In a real app, you would make an API call to your WhatsApp service
      // For now, we'll open WhatsApp Web (this would be replaced with actual API call)
      if (typeof window !== "undefined") {
        window.open(whatsappUrl, "_blank")
      }

      return true
    } catch (error) {
      console.error("Error sending WhatsApp message:", error)
      return false
    }
  }

  // Method for actual API integration (example with Twilio)
  static async sendWhatsAppMessageAPI(messageData: WhatsAppMessage): Promise<boolean> {
    try {
      // This is an example of how you would integrate with Twilio WhatsApp API
      // You would need to set up Twilio credentials and WhatsApp Business account

      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: `whatsapp:+${this.formatPhoneNumber(messageData.to)}`,
          body: messageData.message,
          type: messageData.type,
        }),
      })

      if (response.ok) {
        console.log("WhatsApp message sent successfully")
        return true
      } else {
        console.error("Failed to send WhatsApp message")
        return false
      }
    } catch (error) {
      console.error("Error sending WhatsApp message via API:", error)
      return false
    }
  }
}

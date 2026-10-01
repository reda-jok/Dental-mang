import { z } from "zod"

import { optionalMultiline, optionalPhone, optionalText, text } from "@/lib/validation"

export const clinicSettingsSchema = z.strictObject({
  name: text(2, 100),
  phone: optionalPhone,
  address: optionalText(200),
  receiptFooter: optionalMultiline(300),
})

export type ClinicSettingsInput = z.input<typeof clinicSettingsSchema>

"use client"

import { BanknoteIcon, CreditCardIcon, SmartphoneIcon, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

import { PAYMENT_METHODS, type PaymentMethod } from "../payments"

const ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: BanknoteIcon,
  card: CreditCardIcon,
  wallet: SmartphoneIcon,
}

/** Cash / card / wallet as three large buttons (easy to tap at the front desk). */
export function MethodPicker({
  value,
  onChange,
  labelId,
}: {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  labelId: string
}) {
  const t = useTranslations("billing")
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map((method) => {
        const Icon = ICONS[method]
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={value === method}
            onClick={() => onChange(method)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors",
              value === method
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-slate-200 hover:bg-slate-50",
            )}
          >
            <Icon className="size-5 text-blue-600" aria-hidden />
            <span className="text-sm font-medium">{t(`methods.${method}`)}</span>
            <span className="hidden text-xs text-slate-500 sm:block">
              {t(`methodHints.${method}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

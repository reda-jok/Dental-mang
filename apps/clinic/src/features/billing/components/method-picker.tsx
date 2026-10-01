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

/**
 * Cash / card / wallet as large buttons (easy to tap at the front desk). `methods`
 * limits the choice (labs: cash or transfer); `label` / `hint` replace the wording.
 */
export function MethodPicker<M extends PaymentMethod>({
  value,
  onChange,
  labelId,
  methods = PAYMENT_METHODS as unknown as readonly M[],
  label,
  hint,
}: {
  value: M
  onChange: (method: M) => void
  labelId: string
  methods?: readonly M[]
  label?: (method: M) => string
  hint?: (method: M) => string
}) {
  const t = useTranslations("billing")
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className={cn("grid gap-2", methods.length === 2 ? "grid-cols-2" : "grid-cols-3")}
    >
      {methods.map((method) => {
        const base: PaymentMethod = method
        const Icon = ICONS[base]
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
            <span className="text-sm font-medium">
              {label ? label(method) : t(`methods.${base}`)}
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              {hint ? hint(method) : t(`methodHints.${base}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

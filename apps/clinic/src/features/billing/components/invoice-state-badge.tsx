import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { STATE_BADGE } from "../display"
import type { PaymentState } from "../rules"

export function InvoiceStateBadge({ state }: { state: PaymentState }) {
  const t = useTranslations("billing.states")
  return <Badge className={cn(STATE_BADGE[state])}>{t(state)}</Badge>
}

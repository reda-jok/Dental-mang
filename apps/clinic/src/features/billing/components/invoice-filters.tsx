"use client"

import { SearchIcon, XIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { IconButton } from "@/components/icon-button"
import { InfoHint } from "@/components/info-hint"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { INVOICE_FILTERS } from "../schemas"

type Filter = (typeof INVOICE_FILTERS)[number]

/** Search box + state filter, kept in the URL (?q=&status=) so back and sharing work. */
export function InvoiceFilters({ q, status }: { q: string; status: Filter }) {
  const t = useTranslations("billing")
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(q)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const navigate = (next: { q?: string; status?: Filter }) => {
    const params = new URLSearchParams()
    const query = (next.q ?? value).trim()
    const state = next.status ?? status
    if (query) params.set("q", query)
    if (state !== "all") params.set("status", state)
    const url = params.size ? `${pathname}?${params}` : pathname
    startTransition(() => router.replace(url as Route))
  }

  const onSearch = (next: string) => {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => navigate({ q: next }), 300)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative w-full max-w-md">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={value}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            aria-busy={pending}
            className="ps-9 pe-9"
          />
          {value && (
            <IconButton
              label={t("clearSearch")}
              className="absolute end-1 top-1/2 -translate-y-1/2"
              onClick={() => onSearch("")}
            >
              <XIcon />
            </IconButton>
          )}
        </div>
        <InfoHint>{t("searchHint")}</InfoHint>
      </div>
      <Select value={status} onValueChange={(v) => navigate({ status: v as Filter })}>
        <SelectTrigger className="w-full sm:w-44" aria-label={t("filter")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INVOICE_FILTERS.map((f) => (
            <SelectItem key={f} value={f}>
              {t(`filters.${f}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

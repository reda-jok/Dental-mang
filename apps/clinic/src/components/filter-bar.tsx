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

type Props = {
  q: string
  placeholder: string
  hint: string
  /** The select: its URL parameter, current value, default (left out of the URL) and options. */
  filter: {
    param: string
    label: string
    value: string
    defaultValue: string
    options: { value: string; label: string }[]
  }
}

/** Search box + one filter, kept in the URL (?q=&<param>=) so back and sharing work. */
export function FilterBar({ q, placeholder, hint, filter }: Props) {
  const t = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(q)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const navigate = (next: { q?: string; filter?: string }) => {
    const params = new URLSearchParams()
    const query = (next.q ?? value).trim()
    const selected = next.filter ?? filter.value
    if (query) params.set("q", query)
    if (selected !== filter.defaultValue) params.set(filter.param, selected)
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
            placeholder={placeholder}
            aria-label={placeholder}
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
        <InfoHint>{hint}</InfoHint>
      </div>
      <Select value={filter.value} onValueChange={(v) => navigate({ filter: v })}>
        <SelectTrigger className="w-full sm:w-48" aria-label={filter.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {filter.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

"use client"

import { SearchIcon, XIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { InfoHint } from "@/components/info-hint"
import { IconButton } from "@/components/icon-button"
import { Input } from "@/components/ui/input"

/** Search box that updates ?q= in the URL (debounced), so results are shareable and back works. */
export function PatientSearchInput({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations("patients")
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const navigate = (q: string) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    const url = params.size ? `${pathname}?${params}` : pathname
    startTransition(() => router.replace(url as Route))
  }

  const onChange = (next: string) => {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => navigate(next), 300)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full max-w-md">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          aria-busy={pending}
          className="ps-9 pe-9"
          autoFocus
        />
        {value && (
          <IconButton
            label={t("clearSearch")}
            className="absolute end-1 top-1/2 -translate-y-1/2"
            onClick={() => onChange("")}
          >
            <XIcon />
          </IconButton>
        )}
      </div>
      <InfoHint>{t("searchHint")}</InfoHint>
    </div>
  )
}

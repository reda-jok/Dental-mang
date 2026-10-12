"use client"

import { XIcon } from "lucide-react"
import type { Route } from "next"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ACTIVITY_FILTERS } from "../rules"
import type { ActivitySearch } from "../schemas"

const EVERYONE = "all"

/** Person, kind and day, kept in the URL so back and sharing work. */
export function ActivityFilters({
  search,
  people,
}: {
  search: ActivitySearch
  people: { id: string; name: string }[]
}) {
  const t = useTranslations("activity")
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const navigate = (next: Partial<Pick<ActivitySearch, "person" | "area" | "day">>) => {
    const { person, area, day } = { ...search, ...next }
    const params = new URLSearchParams()
    if (person) params.set("person", person)
    if (area !== "all") params.set("area", area)
    if (day) params.set("day", day)
    const url = params.size ? `${pathname}?${params}` : pathname
    startTransition(() => router.replace(url as Route))
  }

  const filtered = search.person || search.area !== "all" || search.day

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" aria-busy={pending}>
      <div className="space-y-1.5">
        <Label htmlFor="activity-person">{t("person")}</Label>
        <Select
          value={search.person || EVERYONE}
          onValueChange={(v) => navigate({ person: v === EVERYONE ? "" : v })}
        >
          <SelectTrigger id="activity-person" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EVERYONE}>{t("allPeople")}</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="activity-area">{t("area")}</Label>
        <Select
          value={search.area}
          onValueChange={(v) => navigate({ area: v as ActivitySearch["area"] })}
        >
          <SelectTrigger id="activity-area" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {t(`areas.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="activity-day">{t("day")}</Label>
        <Input
          id="activity-day"
          type="date"
          dir="ltr"
          value={search.day}
          onChange={(e) => navigate({ day: e.target.value })}
          className="w-full sm:w-44"
        />
      </div>
      {filtered && (
        <Button variant="ghost" onClick={() => navigate({ person: "", area: "all", day: "" })}>
          <XIcon />
          {t("clear")}
        </Button>
      )}
    </div>
  )
}

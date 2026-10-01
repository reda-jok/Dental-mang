import { SearchIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Input } from "@/components/ui/input"

/** Quick patient search from any page: submits to /patients?q=… */
export async function HeaderSearch() {
  const t = await getTranslations("search")
  return (
    <form action="/patients" method="get" role="search" className="relative w-full max-w-xs">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
      <Input
        name="q"
        type="search"
        placeholder={t("placeholder")}
        aria-label={t("label")}
        className="h-9 ps-9"
      />
    </form>
  )
}

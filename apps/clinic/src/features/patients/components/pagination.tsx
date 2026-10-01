import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Route } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export async function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null
  const t = await getTranslations("patients")
  return (
    <nav
      className="flex items-center justify-between gap-2"
      aria-label={t("pageOf", { page: String(page), count: String(pageCount) })}
    >
      <Button
        asChild
        variant="outline"
        size="sm"
        aria-disabled={page <= 1}
        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
      >
        <Link href={hrefFor(page - 1) as Route}>
          <ChevronRightIcon className="ltr:rotate-180 rtl:rotate-0" />
          {t("previous")}
        </Link>
      </Button>
      <span className="text-muted-foreground text-sm">
        {t("pageOf", { page: String(page), count: String(pageCount) })}
      </span>
      <Button
        asChild
        variant="outline"
        size="sm"
        aria-disabled={page >= pageCount}
        className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
      >
        <Link href={hrefFor(page + 1) as Route}>
          {t("next")}
          <ChevronLeftIcon className="ltr:rotate-180 rtl:rotate-0" />
        </Link>
      </Button>
    </nav>
  )
}

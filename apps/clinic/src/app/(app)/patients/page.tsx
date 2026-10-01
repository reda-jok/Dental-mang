import { PlusIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Panel } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination } from "@/features/patients/components/pagination"
import { PatientSearchInput } from "@/features/patients/components/patient-search-input"
import { PatientsTable } from "@/features/patients/components/patients-table"
import { searchPatients } from "@/features/patients/data"
import { patientSearchSchema } from "@/features/patients/schemas"
import { todayIso } from "@/lib/dates"
import { hasPermission } from "@/lib/permissions"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("patients")
  return { title: t("title") }
}

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const user = await requirePagePermission("patient:read")
  const { q, page } = patientSearchSchema.parse(await searchParams)
  const [{ rows, total, pageCount }, t] = await Promise.all([
    searchPatients({ q, page }),
    getTranslations("patients"),
  ])

  const hrefFor = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (p > 1) params.set("page", String(p))
    return params.size ? `/patients?${params}` : "/patients"
  }

  return (
    <div className="space-y-6">
      {/* Search card */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <PatientSearchInput initialQuery={q} />
          {hasPermission(user.role, "patient:write") && (
            <Button asChild>
              <Link href="/patients/new">
                <PlusIcon />
                {t("add")}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Panel
        icon={UsersIcon}
        title={
          q ? t("resultsTitle", { total: String(total) }) : t("allTitle", { total: String(total) })
        }
        description={t("description")}
        contentClassName="p-0"
      >
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium text-slate-700">{q ? t("noResults", { q }) : t("empty")}</p>
            <p className="text-sm text-slate-400">
              {q ? t("noResultsDescription") : t("emptyDescription")}
            </p>
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {t("results", { total })}
            </p>
            <PatientsTable rows={rows} today={todayIso()} />
            <div className="border-t px-4 py-3">
              <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}

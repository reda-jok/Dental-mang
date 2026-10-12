import { HistoryIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { ActivityFilters } from "@/features/activity/components/activity-filters"
import { ActivityList } from "@/features/activity/components/activity-list"
import { listActivity, listActivityPeople } from "@/features/activity/data"
import { activitySearchSchema } from "@/features/activity/schemas"
import { Pagination } from "@/features/patients/components/pagination"
import { requirePagePermission } from "@/server/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activity")
  return { title: t("title") }
}

export default async function ActivityPage({ searchParams }: PageProps<"/settings/activity">) {
  await requirePagePermission("settings:activity")
  const search = activitySearchSchema.parse(await searchParams)
  const [{ rows, total, pageCount }, people, t] = await Promise.all([
    listActivity(search),
    listActivityPeople(),
    getTranslations("activity"),
  ])
  const filtered = search.person || search.area !== "all" || search.day

  const hrefFor = (page: number) => {
    const params = new URLSearchParams()
    if (search.person) params.set("person", search.person)
    if (search.area !== "all") params.set("area", search.area)
    if (search.day) params.set("day", search.day)
    if (page > 1) params.set("page", String(page))
    return params.size ? `/settings/activity?${params}` : "/settings/activity"
  }

  return (
    <Panel
      icon={HistoryIcon}
      title={t("title")}
      description={t("description")}
      className="min-w-0"
      contentClassName="p-0"
    >
      <div className="border-b p-4">
        <ActivityFilters search={search} people={people} />
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-6 py-12 text-center">
          {filtered ? t("emptyFiltered") : t("empty")}
        </p>
      ) : (
        <>
          <p className="text-muted-foreground px-4 pt-3 text-sm">{t("count", { total })}</p>
          <ActivityList rows={rows} />
          <div className="border-t px-4 py-3">
            <Pagination page={search.page} pageCount={pageCount} hrefFor={hrefFor} />
          </div>
        </>
      )}
    </Panel>
  )
}

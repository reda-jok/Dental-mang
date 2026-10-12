import { getTranslations } from "next-intl/server"

import { LoadingLogo } from "@/components/logo"

/** Shown while a page loads: the Al-Tamkeen mark building itself, in the content area. */
export default async function Loading() {
  const t = await getTranslations("common")
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingLogo label={t("loading")} />
    </div>
  )
}

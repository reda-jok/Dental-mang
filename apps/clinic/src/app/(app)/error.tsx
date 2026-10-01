"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const t = useTranslations("errorPage")
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      {error.digest && (
        <p className="text-muted-foreground text-xs" dir="auto">
          {t("reference", { digest: error.digest })}
        </p>
      )}
      <Button onClick={() => retry()}>{t("retry")}</Button>
    </div>
  )
}

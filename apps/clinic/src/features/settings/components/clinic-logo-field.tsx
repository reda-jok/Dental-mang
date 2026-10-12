"use client"

import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useRef, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useActionErrorHandler } from "@/lib/form"

/** Settings → Clinic: the logo printed on prescriptions, receipts and quotes. */
export function ClinicLogoField({
  logoUrl,
  canEdit,
}: {
  logoUrl: string | null
  canEdit: boolean
}) {
  const t = useTranslations("settings")
  const router = useRouter()
  const handleError = useActionErrorHandler()
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const send = (init: RequestInit, done: string) =>
    startTransition(async () => {
      const response = await fetch("/api/clinic-logo", init)
      const result = await response.json()
      if (!result.ok) return handleError(result)
      toast.success(t(done as "logoSaved"))
      router.refresh()
    })

  return (
    <section className="max-w-xl space-y-3" aria-labelledby="logo-title">
      <div>
        <h3 id="logo-title" className="font-semibold">
          {t("logo")}
        </h3>
        <p className="text-muted-foreground text-sm">{t("logoHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-muted/40 flex size-24 items-center justify-center rounded-xl border">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a stored upload, served as is
            <img src={logoUrl} alt={t("logo")} className="max-h-20 max-w-20 object-contain" />
          ) : (
            <span className="text-muted-foreground text-xs">{t("noLogo")}</span>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label={t("uploadLogo")}
              data-testid="logo-input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (!file) return
                const body = new FormData()
                body.set("file", file)
                send({ method: "POST", body }, "logoSaved")
              }}
            />
            <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
              <ImageUpIcon />
              {logoUrl ? t("replaceLogo") : t("uploadLogo")}
            </Button>
            {logoUrl && (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => send({ method: "DELETE" }, "logoRemoved")}
              >
                <Trash2Icon />
                {t("removeLogo")}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

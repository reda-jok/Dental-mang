"use client"

import { BadgePercentIcon, BanIcon, type LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useOptimistic, useTransition } from "react"
import { toast } from "sonner"

import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useActionErrorHandler } from "@/lib/form"
import type { AdjustablePermission, RoleName } from "@/lib/permissions"

import { setRolePermissionAction } from "../actions"
import type { PermissionSetting } from "../data"

const ICONS: Record<AdjustablePermission, LucideIcon> = {
  "billing:discount": BadgePercentIcon,
  "billing:void": BanIcon,
}

/** One card per adjustable permission, with a switch for each eligible role. */
export function PermissionSettings({ settings }: { settings: PermissionSetting[] }) {
  const t = useTranslations("permissions")
  const tr = useTranslations("roles")

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {settings.map(({ permission, roles }) => {
        const key = permission.split(":")[1] as "discount" | "void"
        const Icon = ICONS[permission]
        const titleId = `permission-${key}`
        return (
          <section
            key={permission}
            aria-labelledby={titleId}
            className="min-w-0 rounded-xl border border-slate-200 p-4"
          >
            <h3 id={titleId} className="flex items-center gap-2 font-semibold text-slate-800">
              <Icon className="size-4 text-blue-500" aria-hidden />
              {t(`items.${key}.title`)}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{t(`items.${key}.description`)}</p>
            <ul className="mt-4 divide-y divide-slate-100">
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium">{tr("owner")}</span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary">{t("always")}</Badge>
                  <InfoHint>{t("ownerAlways")}</InfoHint>
                </span>
              </li>
              {roles.map(({ role, granted }) => (
                <RoleSwitch key={role} permission={permission} role={role} granted={granted} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function RoleSwitch({
  permission,
  role,
  granted,
}: {
  permission: AdjustablePermission
  role: RoleName
  granted: boolean
}) {
  const t = useTranslations("permissions")
  const tr = useTranslations("roles")
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [checked, setChecked] = useOptimistic(granted)
  const id = `${permission}-${role}`

  const toggle = (next: boolean) =>
    startTransition(async () => {
      setChecked(next)
      const result = await setRolePermissionAction({ role, permission, granted: next })
      if (!result.ok) return handleError(result)
      toast.success(t(next ? "granted" : "removed", { role: tr(role) }))
    })

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {tr(role)}
      </Label>
      <Switch id={id} checked={checked} disabled={pending} onCheckedChange={toggle} />
    </li>
  )
}

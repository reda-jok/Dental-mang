"use client"

import {
  BanknoteIcon,
  CalendarDaysIcon,
  FlaskConicalIcon,
  SettingsIcon,
  StethoscopeIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
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

type Group<P = AdjustablePermission> = P extends `${infer G}:${string}` ? G : never
/** "billing:void" → "billing.void", the permission's key under `permissions.items`. */
type ItemKey<P = AdjustablePermission> = P extends `${infer G}:${infer A}` ? `${G}.${A}` : never

const ICONS: Record<Group, LucideIcon> = {
  patient: UsersIcon,
  clinical: StethoscopeIcon,
  appointment: CalendarDaysIcon,
  billing: BanknoteIcon,
  lab: FlaskConicalIcon,
  hr: UserCogIcon,
  settings: SettingsIcon,
}

const groupOf = (permission: AdjustablePermission) => permission.split(":")[0] as Group
const itemKey = (permission: AdjustablePermission) => permission.replace(":", ".") as ItemKey

/**
 * The adjustable permissions grouped by area, one card each with a switch per role. A
 * role missing a prerequisite gets a locked switch; the card names what it needs.
 */
export function PermissionSettings({ settings }: { settings: PermissionSetting[] }) {
  const t = useTranslations("permissions")
  const tr = useTranslations("roles")
  const format = useFormatter()
  const title = (permission: AdjustablePermission) => t(`items.${itemKey(permission)}.title`)
  const groups = [...new Set(settings.map((s) => groupOf(s.permission)))]

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const Icon = ICONS[group]
        return (
          <section key={group} aria-labelledby={`permissions-${group}`} className="space-y-3">
            <h3
              id={`permissions-${group}`}
              className="flex items-center gap-2 font-semibold text-foreground"
            >
              <Icon className="text-primary size-4" aria-hidden />
              {t(`groups.${group}`)}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {settings
                .filter((s) => groupOf(s.permission) === group)
                .map(({ permission, requires, roles }) => {
                  const titleId = `permission-${permission.replace(":", "-")}`
                  return (
                    <section
                      key={permission}
                      aria-labelledby={titleId}
                      className="min-w-0 rounded-xl border p-4"
                    >
                      <h4 id={titleId} className="font-semibold text-foreground">
                        {title(permission)}
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(`items.${itemKey(permission)}.description`)}
                      </p>
                      {requires.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("requires", { names: format.list(requires.map(title)) })}
                        </p>
                      )}
                      <ul className="mt-4 divide-y divide-border">
                        <li className="flex items-center justify-between gap-3 py-2.5">
                          <span className="text-sm font-medium">{tr("owner")}</span>
                          <span className="flex items-center gap-1">
                            <Badge variant="secondary">{t("always")}</Badge>
                            <InfoHint>{t("ownerAlways")}</InfoHint>
                          </span>
                        </li>
                        {roles.map(({ role, granted, blocked }) => (
                          <RoleSwitch
                            key={role}
                            permission={permission}
                            role={role}
                            granted={granted}
                            blocked={blocked}
                          />
                        ))}
                      </ul>
                    </section>
                  )
                })}
            </div>
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
  blocked,
}: {
  permission: AdjustablePermission
  role: RoleName
  granted: boolean
  blocked: boolean
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
      <Label htmlFor={id} className={blocked ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
        {tr(role)}
      </Label>
      <Switch id={id} checked={checked} disabled={pending || blocked} onCheckedChange={toggle} />
    </li>
  )
}

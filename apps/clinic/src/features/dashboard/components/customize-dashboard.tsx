"use client"

import { ArrowDownIcon, ArrowUpIcon, LayoutDashboardIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useActionErrorHandler } from "@/lib/form"
import type { RoleName } from "@/lib/permissions"

import { resetOwnLayoutAction, saveOwnLayoutAction, saveRoleLayoutAction } from "../actions"
import { WIDGETS, type LayoutItem } from "../widgets"

type Result = Awaited<ReturnType<typeof saveOwnLayoutAction>>

const SIZE = new Map<string, "stat" | "wide">(WIDGETS.map((w) => [w.key, w.size]))

/**
 * Show / hide and reorder the dashboard's widgets (up / down buttons work on touch).
 * The owner can also save the arrangement as the default for a role.
 */
export function CustomizeDashboard({
  items,
  custom,
  roles,
}: {
  items: LayoutItem[]
  custom: boolean
  /** Roles the owner can set a default for; null for everyone else. */
  roles: RoleName[] | null
}) {
  const t = useTranslations("dashboard")
  const tr = useTranslations("roles")
  const handleError = useActionErrorHandler()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(items)
  const [role, setRole] = useState<RoleName | "">(roles?.[0] ?? "")
  const [pending, startTransition] = useTransition()

  const name = (item: LayoutItem) => t(`widgets.${item.key}`)
  // Cards and panels are ordered separately (the page shows the cards first), so a move
  // swaps with the neighbour of the same kind.
  const groups = (["stat", "wide"] as const).map((size) => ({
    size,
    items: list.filter((i) => SIZE.get(i.key) === size),
  }))
  const move = (group: LayoutItem[], index: number, by: -1 | 1) =>
    setList((current) => {
      const a = current.indexOf(group[index]!)
      const b = current.indexOf(group[index + by]!)
      const next = [...current]
      ;[next[a], next[b]] = [next[b]!, next[a]!]
      return next
    })
  const run = (action: () => Promise<Result>, done: string) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) return handleError(result)
      toast.success(done)
      setOpen(false)
    })

  return (
    <>
      <Button variant="outline" onClick={() => (setList(items), setOpen(true))}>
        <LayoutDashboardIcon />
        {t("customize")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("customizeTitle")}</DialogTitle>
            <DialogDescription>{t("customizeDescription")}</DialogDescription>
          </DialogHeader>

          {groups.map(({ size, items: group }) =>
            group.length === 0 ? null : (
              <section key={size} className="space-y-2" data-group={size}>
                <h3 className="text-sm font-semibold text-slate-700">{t(`groups.${size}`)}</h3>
                <ol className="space-y-2">
                  {group.map((item, index) => (
                    <li
                      key={item.key}
                      data-widget-row={item.key}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
                    >
                      <Switch
                        id={`widget-${item.key}`}
                        checked={!item.hidden}
                        aria-label={t("show", { name: name(item) })}
                        onCheckedChange={(on) =>
                          setList((current) =>
                            current.map((w) => (w.key === item.key ? { ...w, hidden: !on } : w)),
                          )
                        }
                      />
                      <Label htmlFor={`widget-${item.key}`} className="flex-1">
                        {name(item)}
                      </Label>
                      <IconButton
                        label={t("moveUp", { name: name(item) })}
                        disabledReason={index === 0 ? t("atTop") : null}
                        onClick={() => move(group, index, -1)}
                      >
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton
                        label={t("moveDown", { name: name(item) })}
                        disabledReason={index === group.length - 1 ? t("atBottom") : null}
                        onClick={() => move(group, index, 1)}
                      >
                        <ArrowDownIcon />
                      </IconButton>
                    </li>
                  ))}
                </ol>
              </section>
            ),
          )}

          {roles && roles.length > 0 && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <Label htmlFor="layoutRole">{t("roleDefault")}</Label>
              <p className="text-xs text-slate-500">{t("roleDefaultHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Select value={role} onValueChange={(v) => setRole(v as RoleName)}>
                  <SelectTrigger id="layoutRole" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tr(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={pending || !role}
                  onClick={() =>
                    run(
                      () => saveRoleLayoutAction({ role, widgets: list }),
                      t("roleSaved", { role: role ? tr(role) : "" }),
                    )
                  }
                >
                  {t("saveForRole")}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {custom ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => resetOwnLayoutAction({}), t("layoutReset"))}
              >
                {t("resetLayout")}
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={pending}
              onClick={() => run(() => saveOwnLayoutAction({ widgets: list }), t("layoutSaved"))}
            >
              {t("saveLayout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

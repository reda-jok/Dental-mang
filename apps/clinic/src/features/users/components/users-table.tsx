"use client"

import { KeyRoundIcon, PencilIcon, PlusIcon, UserCheckIcon, UserXIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { IconButton } from "@/components/icon-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionErrorHandler } from "@/lib/form"
import { ROLE_NAMES, type RoleName } from "@/lib/permissions"

import { setUserActiveAction } from "../actions"
import { checkUserChange, type Actor, type UserChange } from "../policy"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { UserFormDialog } from "./user-form-dialog"

type Row = {
  id: string
  name: string
  username: string
  role: RoleName
  active: boolean
  lastLoginAt: Date | null
}

export function UsersTable({ rows, actor }: { rows: Row[]; actor: Actor }) {
  const t = useTranslations()
  const format = useFormatter()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [resetting, setResetting] = useState<Row | null>(null)
  const [disabling, setDisabling] = useState<Row | null>(null)

  const activeOwnerCount = rows.filter((r) => r.role === "owner" && r.active).length
  const assignableRoles = ROLE_NAMES.filter(
    (role) => checkUserChange(actor, null, { kind: "create", role }, activeOwnerCount) === null,
  )

  /** Same rule the server enforces, used here to explain disabled buttons. */
  const denial = (row: Row, change: UserChange) => {
    const reason = checkUserChange(actor, row, change, activeOwnerCount)
    return reason ? t(`errors.${reason}`) : null
  }

  const setActive = (row: Row, active: boolean) =>
    startTransition(async () => {
      const result = await setUserActiveAction({ id: row.id, active })
      if (!result.ok) return handleError(result)
      toast.success(t(active ? "users.enabledToast" : "users.disabledToast"))
      setDisabling(null)
    })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <PlusIcon />
          {t("users.add")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.name")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("users.username")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("users.status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("users.lastLogin")}</TableHead>
              <TableHead className="text-end">{t("users.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={row.active ? undefined : "text-muted-foreground"}>
                <TableCell className="font-medium">
                  {row.name}
                  {row.id === actor.id && (
                    <Badge variant="outline" className="ms-2">
                      {t("users.you")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell" dir="ltr">
                  <span className="block text-end">{row.username}</span>
                </TableCell>
                <TableCell>{t(`roles.${row.role}`)}</TableCell>
                <TableCell>
                  <Badge variant={row.active ? "secondary" : "outline"}>
                    {row.active ? t("users.active") : t("users.disabled")}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {row.lastLoginAt
                    ? format.dateTime(row.lastLoginAt, { dateStyle: "medium", timeStyle: "short" })
                    : t("common.never")}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <IconButton
                      label={t("users.editTip")}
                      disabledReason={denial(row, { kind: "edit", role: row.role })}
                      onClick={() => setEditing(row)}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label={t("users.resetPasswordTip")}
                      disabledReason={denial(row, { kind: "resetPassword" })}
                      onClick={() => setResetting(row)}
                    >
                      <KeyRoundIcon />
                    </IconButton>
                    {row.active ? (
                      <IconButton
                        label={t("users.disableTip")}
                        disabledReason={denial(row, { kind: "disable" })}
                        onClick={() => setDisabling(row)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserXIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        label={t("users.enableTip")}
                        disabledReason={denial(row, { kind: "enable" })}
                        onClick={() => setActive(row, true)}
                      >
                        <UserCheckIcon />
                      </IconButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        open={creating}
        onOpenChange={setCreating}
        assignableRoles={assignableRoles}
      />
      <UserFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        assignableRoles={assignableRoles}
        user={editing ?? undefined}
      />
      <ResetPasswordDialog user={resetting} onOpenChange={(open) => !open && setResetting(null)} />

      <AlertDialog open={!!disabling} onOpenChange={(open) => !open && setDisabling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("users.disableTitle", { name: disabling?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("users.disableDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault() // keep open until the server confirms
                if (disabling) setActive(disabling, false)
              }}
            >
              {t("users.disableConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

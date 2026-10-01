"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FolderPlusIcon, ListPlusIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { TextField } from "@/components/form-field"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"
import { formatMoney } from "@/lib/money"

import { archiveProcedureAction, createCategoryAction, loadStarterCatalogAction } from "../actions"
import type { Catalog, CatalogProcedure } from "../data"
import { categorySchema } from "../schemas"
import { ProcedureDialog } from "./procedure-dialog"

export function CatalogManager({
  catalog,
  canEdit,
  openNew = false,
}: {
  catalog: Catalog
  canEdit: boolean
  /** Open the "add procedure" dialog right away. */
  openNew?: boolean
}) {
  const t = useTranslations()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState<{ categoryId?: string } | null>(
    openNew && canEdit && catalog.length > 0 ? {} : null,
  )
  const [editing, setEditing] = useState<CatalogProcedure | null>(null)
  const [archiving, setArchiving] = useState<CatalogProcedure | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)

  const isEmpty = catalog.every((c) => c.procedures.length === 0)
  const categories = catalog.map(({ id, name }) => ({ id, name }))

  const loadStarter = () =>
    startTransition(async () => {
      const result = await loadStarterCatalogAction({})
      if (!result.ok) return handleError(result)
      toast.success(t("procedures.starterLoaded"))
    })

  const archive = (p: CatalogProcedure) =>
    startTransition(async () => {
      const result = await archiveProcedureAction({ id: p.id })
      if (!result.ok) return handleError(result)
      toast.success(t("procedures.archived"))
      setArchiving(null)
    })

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setAddingCategory(true)}>
            <FolderPlusIcon />
            {t("procedures.addCategory")}
          </Button>
          <Button onClick={() => setAdding({})} disabled={categories.length === 0}>
            <PlusIcon />
            {t("procedures.add")}
          </Button>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{t("procedures.empty")}</p>
          <p className="text-muted-foreground mb-4 text-sm">{t("procedures.emptyDescription")}</p>
          {canEdit && (
            <Button onClick={loadStarter} disabled={pending}>
              <ListPlusIcon />
              {t("procedures.loadStarter")}
            </Button>
          )}
        </div>
      )}

      {catalog
        .filter((c) => c.procedures.length > 0)
        .map((category) => (
          <section key={category.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{category.name}</h2>
              {canEdit && (
                <IconButton
                  label={t("procedures.add")}
                  onClick={() => setAdding({ categoryId: category.id })}
                >
                  <PlusIcon />
                </IconButton>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              {/* Fixed widths so the columns line up across all category tables. */}
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("procedures.name")}</TableHead>
                    <TableHead className="w-36">{t("procedures.price")}</TableHead>
                    <TableHead className="hidden w-44 md:table-cell">
                      {t("procedures.toothScope")}
                    </TableHead>
                    <TableHead className="hidden w-28 md:table-cell">
                      {t("procedures.duration")}
                    </TableHead>
                    {canEdit && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.procedures.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.requiresLab && (
                          <Badge variant="outline" className="ms-2">
                            {t("procedures.lab")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.price === "0" ? (
                          <Badge variant="destructive">{t("procedures.priceNotSet")}</Badge>
                        ) : (
                          <span dir="ltr">{formatMoney(p.price, p.currency)}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t(`procedures.toothScopes.${p.toothScope}`)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.durationMinutes ?? "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end">
                            <IconButton
                              label={t("procedures.editTip")}
                              onClick={() => setEditing(p)}
                            >
                              <PencilIcon />
                            </IconButton>
                            <IconButton
                              label={t("procedures.archiveTip")}
                              className="text-destructive"
                              onClick={() => setArchiving(p)}
                            >
                              <Trash2Icon />
                            </IconButton>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ))}

      <ProcedureDialog
        open={!!adding}
        onOpenChange={(open) => !open && setAdding(null)}
        categories={categories}
        defaultCategoryId={adding?.categoryId}
      />
      <ProcedureDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories}
        procedure={editing ?? undefined}
      />
      <CategoryDialog open={addingCategory} onOpenChange={setAddingCategory} />

      <AlertDialog open={!!archiving} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("procedures.archiveTitle", { name: archiving?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("procedures.archiveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                if (archiving) archive(archiving)
              }}
            >
              {t("procedures.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useTranslations()
  const handleError = useActionErrorHandler()
  const [pending, startTransition] = useTransition()
  const form = useForm<{ name: string }>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  })

  const onInvalid = useInvalidHandler()
  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const result = await createCategoryAction(form.getValues())
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("procedures.categoryCreated"))
        form.reset()
        onOpenChange(false)
      }),
    onInvalid,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("procedures.categoryTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <TextField
            id="categoryName"
            label={t("procedures.categoryName")}
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

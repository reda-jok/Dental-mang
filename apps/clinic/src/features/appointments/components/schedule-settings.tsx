"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionErrorHandler, useInvalidHandler } from "@/lib/form"

import { addRoomAction, archiveRoomAction, updateScheduleSettingsAction } from "../actions"
import { minutesToHhmm, WEEK_START } from "../rules"
import { scheduleSettingsSchema } from "../schemas"

type Props = {
  canEdit: boolean
  config: { dayStart: number; dayEnd: number; slotMinutes: number; weeklyOffDays: number[] }
  rooms: { id: string; name: string }[]
}

type FormValues = { dayStart: string; dayEnd: string; slotMinutes: string; weeklyOffDays: number[] }

/** Working hours, slot length, weekly days off and rooms. */
export function ScheduleSettings({ canEdit, config, rooms }: Props) {
  const t = useTranslations("appointments")
  const tc = useTranslations("common")
  const handleError = useActionErrorHandler()
  const onInvalid = useInvalidHandler()
  const [pending, startTransition] = useTransition()
  const [roomName, setRoomName] = useState("")
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(scheduleSettingsSchema as never) as never,
    mode: "onTouched",
    defaultValues: {
      dayStart: minutesToHhmm(config.dayStart),
      dayEnd: minutesToHhmm(config.dayEnd),
      slotMinutes: String(config.slotMinutes),
      weeklyOffDays: config.weeklyOffDays,
    },
  })
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit(
    () =>
      startTransition(async () => {
        const values = form.getValues()
        const result = await updateScheduleSettingsAction({
          ...values,
          slotMinutes: values.slotMinutes,
        } as never)
        if (!result.ok) return handleError(result, form.setError)
        toast.success(t("settings.saved"))
        form.reset(values)
      }),
    onInvalid,
  )

  const addRoom = () =>
    startTransition(async () => {
      const result = await addRoomAction({ name: roomName })
      if (!result.ok) return handleError(result)
      toast.success(t("settings.roomAdded"))
      setRoomName("")
    })

  const removeRoom = (id: string) =>
    startTransition(async () => {
      const result = await archiveRoomAction({ id })
      if (!result.ok) return handleError(result)
      toast.success(t("settings.roomRemoved"))
      setRemoving(null)
    })

  // Saturday first, as on the calendar.
  const weekdays = Array.from({ length: 7 }, (_, i) => (WEEK_START + i) % 7)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={!canEdit || pending}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="dayStart"
                type="time"
                dir="ltr"
                label={t("settings.dayStart")}
                error={errors.dayStart?.message}
                {...form.register("dayStart")}
              />
              <TextField
                id="dayEnd"
                type="time"
                dir="ltr"
                label={t("settings.dayEnd")}
                error={errors.dayEnd?.message}
                {...form.register("dayEnd")}
              />
            </div>
            <TextField
              id="slotMinutes"
              inputMode="numeric"
              dir="ltr"
              className="max-w-32"
              label={t("settings.slotMinutes")}
              info={t("settings.slotHint")}
              error={errors.slotMinutes?.message}
              {...form.register("slotMinutes")}
            />
            <Controller
              control={form.control}
              name="weeklyOffDays"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">{t("settings.weeklyOff")}</FieldLegend>
                  <div className="flex flex-wrap gap-4">
                    {weekdays.map((day) => {
                      const checked = field.value.includes(day)
                      return (
                        <div key={day} className="flex items-center gap-2">
                          <Checkbox
                            id={`off-${day}`}
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c ? [...field.value, day] : field.value.filter((d) => d !== day),
                              )
                            }
                          />
                          <Label htmlFor={`off-${day}`} className="font-normal">
                            {t(`weekdays.${day}` as "weekdays.0")}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </FieldSet>
              )}
            />
            {canEdit && (
              <div>
                <Button type="submit" disabled={!isDirty || pending}>
                  {pending ? tc("saving") : t("settings.save")}
                </Button>
              </div>
            )}
          </FieldGroup>
        </fieldset>
      </form>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">{t("settings.rooms")}</h3>
          <p className="text-sm text-slate-500">{t("settings.roomsHint")}</p>
        </div>
        {rooms.length === 0 ? (
          <p className="text-sm text-slate-400">{t("settings.noRooms")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rooms.map((room) => (
              <li key={room.id} className="flex items-center justify-between px-3 py-2">
                <span>{room.name}</span>
                {canEdit && (
                  <IconButton
                    label={t("settings.removeRoom")}
                    className="text-destructive"
                    onClick={() => setRemoving(room)}
                  >
                    <Trash2Icon />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (roomName.trim()) addRoom()
            }}
          >
            <Input
              aria-label={t("settings.roomName")}
              placeholder={t("settings.roomName")}
              value={roomName}
              maxLength={50}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={pending || !roomName.trim()}>
              <PlusIcon />
              {t("settings.addRoom")}
            </Button>
          </form>
        )}
      </section>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.removeRoom")}: {removing?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("settings.removeRoomDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                if (removing) removeRoom(removing.id)
              }}
            >
              {t("settings.removeRoom")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

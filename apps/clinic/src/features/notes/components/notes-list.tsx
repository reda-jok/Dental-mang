import { LockIcon } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"

import { InfoHint } from "@/components/info-hint"
import { Badge } from "@/components/ui/badge"
import { parseIsoDate } from "@/lib/dates"

import type { ClinicalNoteView } from "../data"
import { NoteActions } from "./note-form-dialogs"

/** A patient's visit notes, newest visit first. */
export function NotesList({ notes, canWrite }: { notes: ClinicalNoteView[]; canWrite: boolean }) {
  const t = useTranslations("clinicalNotes")
  const format = useFormatter()
  const when = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" })
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li
          key={note.id}
          data-note={note.visitOn}
          className="rounded-xl border border-slate-200 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">
                {format.dateTime(parseIsoDate(note.visitOn)!, {
                  dateStyle: "full",
                  timeZone: "UTC",
                })}
                {note.appointmentAt && (
                  <span className="ms-2 text-sm font-normal text-slate-500">
                    {t("appointmentAt", {
                      time: format.dateTime(note.appointmentAt, { timeStyle: "short" }),
                    })}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {t("writtenBy", { name: note.authorName ?? t("unknownAuthor") })}
                {" · "}
                {t("signedAt", { time: when(note.signedAt) })}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {note.amendedAt ? (
                <Badge variant="secondary" data-testid="note-amended">
                  {t("amendedOn", { date: when(note.amendedAt) })}
                </Badge>
              ) : (
                note.corrected && <Badge variant="outline">{t("corrected")}</Badge>
              )}
              {note.locked && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <LockIcon className="size-3.5" aria-hidden />
                  {t("locked")}
                  <InfoHint>{t("lockedHint")}</InfoHint>
                </span>
              )}
              {canWrite && <NoteActions note={note} />}
            </div>
          </div>

          {note.treatments.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              <span className="text-slate-500">{t("doneThatDay")}:</span>
              {note.treatments.map((item) => (
                <Badge key={item.id} variant="outline">
                  {item.name}
                  {item.tooth && (
                    <span className="text-slate-500">
                      {t("tooth", { tooth: String(item.tooth) })}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}

          <p className="mt-3 text-sm leading-7 whitespace-pre-line" data-testid="note-body">
            {note.body}
          </p>

          {note.history.length > 0 && (
            <details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer text-slate-600">
                {t("history", { count: String(note.history.length) })}
              </summary>
              <ol className="mt-2 space-y-3">
                {note.history.map((v) => (
                  <li key={v.version} data-version={v.version}>
                    <p className="text-xs text-slate-500">
                      <Badge variant="outline" className="me-1">
                        {v.version === 1
                          ? t("originalTag")
                          : v.amendment
                            ? t("amendmentTag")
                            : t("correctionTag")}
                      </Badge>
                      {t("versionLine", {
                        version: String(v.version),
                        name: v.writtenByName ?? t("unknownAuthor"),
                        date: when(v.writtenAt),
                      })}
                    </p>
                    <p className="mt-1 leading-7 whitespace-pre-line text-slate-600">{v.body}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </li>
      ))}
    </ul>
  )
}

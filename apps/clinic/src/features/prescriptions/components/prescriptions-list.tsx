import { useFormatter, useTranslations } from "next-intl"

import { parseIsoDate } from "@/lib/dates"

import { PrintLink } from "../../printing/components/print-link"
import type { PrescriptionView } from "../data"

/** A patient's prescriptions, newest first, each with a print button. */
export function PrescriptionsList({ prescriptions }: { prescriptions: PrescriptionView[] }) {
  const t = useTranslations("prescriptions")
  const format = useFormatter()
  return (
    <ul className="space-y-3">
      {prescriptions.map((p) => (
        <li
          key={p.id}
          data-prescription={p.issuedOn}
          className="rounded-xl border border-slate-200 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {format.dateTime(parseIsoDate(p.issuedOn)!, { dateStyle: "long", timeZone: "UTC" })}
              {p.prescribedByName && (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  {p.prescribedByName}
                </span>
              )}
            </p>
            <PrintLink href={`/print/prescription/${p.id}`} label={t("print")} compact />
          </div>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm">
            {p.items.map((item) => (
              <li key={item.id}>
                <bdi className="font-medium">{item.name}</bdi>
                <span className="text-slate-600">
                  {" — "}
                  {[
                    item.dose,
                    item.frequency,
                    item.duration && t("forDuration", { duration: item.duration }),
                  ]
                    .filter(Boolean)
                    .join("، ")}
                </span>
              </li>
            ))}
          </ol>
          {p.notes && <p className="mt-2 text-sm text-slate-600">{p.notes}</p>}
          {p.acknowledged.length > 0 && (
            <p className="mt-2 text-xs text-red-700">{t("acknowledgedNote")}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

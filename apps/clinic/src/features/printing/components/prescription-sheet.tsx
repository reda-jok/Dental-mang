import { getFormatter, getTranslations } from "next-intl/server"

import type { PrescriptionPrint } from "@/features/prescriptions/data"
import type { Letterhead } from "@/features/settings/data"
import { ageInYears, parseIsoDate } from "@/lib/dates"

import { LetterheadBlock, PaperSheet } from "./sheets"

/** A prescription on the clinic's paper (A5 by default): ℞, numbered medicines, signature. */
export async function PrescriptionSheet({
  prescription,
  letterhead,
}: {
  prescription: PrescriptionPrint
  letterhead: Letterhead
}) {
  const t = await getTranslations("print")
  const tr = await getTranslations("prescriptions")
  const tg = await getTranslations("patients")
  const format = await getFormatter()
  const { patient } = prescription
  const age = patient.birthDate ? ageInYears(patient.birthDate, prescription.issuedOn) : null

  return (
    <PaperSheet paper={letterhead.paper}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <LetterheadBlock letterhead={letterhead} align="start" />
        <div className="text-end">
          <p className="text-lg font-bold">{t("prescriptionTitle")}</p>
          <p>
            {format.dateTime(parseIsoDate(prescription.issuedOn)!, {
              dateStyle: "long",
              timeZone: "UTC",
            })}
          </p>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex gap-1.5">
          <dt className="text-slate-600">{t("patient")}:</dt>
          <dd className="font-semibold">{patient.fullName}</dd>
        </div>
        {age !== null && (
          <div className="flex gap-1.5">
            <dt className="text-slate-600">{t("age")}:</dt>
            <dd>{t("years", { count: age })}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-slate-600">{t("sex")}:</dt>
          <dd>{tg(patient.gender)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate-600">{t("code")}:</dt>
          <dd>
            <bdi>{patient.code}</bdi>
          </dd>
        </div>
      </dl>

      {/* ℞ is written left-to-right, as on any prescription. */}
      <p className="mt-4 text-3xl font-bold" dir="ltr" aria-hidden>
        {"℞"}
      </p>
      <ol className="mt-2 space-y-3" data-testid="prescription-items">
        {prescription.items.map((item, index) => (
          <li key={item.id} className="break-inside-avoid">
            <p className="text-[13px] font-bold" dir="ltr">
              <span className="block text-start">
                {index + 1}. {item.name}
              </span>
            </p>
            <p className="ps-4">
              {[
                item.dose,
                item.frequency,
                item.duration && tr("forDuration", { duration: item.duration }),
              ]
                .filter(Boolean)
                .join("، ")}
            </p>
            {item.notes && <p className="ps-4 text-slate-700">{item.notes}</p>}
          </li>
        ))}
      </ol>

      {prescription.notes && (
        <p className="mt-4 whitespace-pre-line">
          <span className="font-semibold">{t("notes")}: </span>
          {prescription.notes}
        </p>
      )}

      <div className="mt-10 flex justify-end">
        <div className="w-48 border-t border-black pt-1.5 text-center">
          {prescription.prescribedByName && (
            <p className="font-semibold">{prescription.prescribedByName}</p>
          )}
          <p>{t("dentistSignature")}</p>
        </div>
      </div>

      {letterhead.footer && (
        <p className="mt-6 text-center text-[11px] whitespace-pre-line text-slate-600">
          {letterhead.footer}
        </p>
      )}
    </PaperSheet>
  )
}

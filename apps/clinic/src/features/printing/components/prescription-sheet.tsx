import { getFormatter, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import type { PrescriptionPrint } from "@/features/prescriptions/data"
import type { Letterhead } from "@/features/settings/data"
import { ageInYears, parseIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { formatLocalPhone } from "@/lib/validation"

import { FitPage } from "./fit-page"
import { PaperSheet } from "./sheets"

/**
 * A prescription on the clinic's paper (A5 by default), laid out like an Iraqi prescription
 * pad: the dentist in Arabic on the right and in English on the left, the logo between;
 * the patient, ℞ and the numbered medicines; a box for the stamp and signature; the
 * clinic's address and phone in a band at the bottom. Always one page.
 */
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
  const { patient, doctor } = prescription
  const age = patient.birthDate ? ageInYears(patient.birthDate, prescription.issuedOn) : null
  const a5 = letterhead.paper === "A5"
  const contact = [
    letterhead.address,
    letterhead.phone && formatLocalPhone(letterhead.phone),
  ].filter(Boolean)

  const info = (label: string, value: ReactNode, wide = false) => (
    <div className={cn(wide ? "min-w-0 flex-1" : "shrink-0")}>
      <dt className="text-[0.8em] text-slate-600">{label}</dt>
      <dd className={cn("font-semibold", wide ? "truncate" : "whitespace-nowrap")}>{value}</dd>
    </div>
  )

  return (
    <PaperSheet paper={letterhead.paper}>
      <FitPage paper={letterhead.paper}>
        <div
          className={cn("flex flex-col", a5 ? "min-h-[186mm]" : "min-h-[262mm]")}
          data-testid="prescription"
        >
          {/* The dentist, in Arabic (right) and English (left), the logo between. */}
          <header
            dir="ltr"
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b-[3px] border-double border-black pb-2.5"
          >
            <div className="min-w-0 text-start">
              {doctor?.nameEn && <p className="text-[1.2em] font-bold">{doctor.nameEn}</p>}
              {doctor?.specialityEn && <p>{doctor.specialityEn}</p>}
            </div>
            <div className="flex flex-col items-center text-center">
              {letterhead.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- printed as is, no resizing
                <img
                  src={letterhead.logoUrl}
                  alt={letterhead.name}
                  className={cn(
                    "object-contain",
                    a5 ? "max-h-[16mm] max-w-[30mm]" : "max-h-[22mm] max-w-[40mm]",
                  )}
                />
              ) : null}
              <p
                dir="rtl"
                className={cn(
                  "font-bold",
                  letterhead.logoUrl ? "mt-1 text-[0.9em]" : "text-[1.15em]",
                )}
              >
                {letterhead.name}
              </p>
            </div>
            <div dir="rtl" className="min-w-0 text-start">
              {doctor && <p className="text-[1.2em] font-bold">{doctor.name}</p>}
              {doctor?.speciality && <p>{doctor.speciality}</p>}
            </div>
          </header>

          {/* The patient */}
          <dl className="mt-3 flex gap-x-5 rounded-md border border-black px-3 py-2">
            {info(t("patient"), patient.fullName, true)}
            {info(t("age"), age !== null ? t("years", { count: age }) : "—")}
            {info(t("sex"), tg(patient.gender))}
            {info(
              t("date"),
              format.dateTime(parseIsoDate(prescription.issuedOn)!, {
                dateStyle: "medium",
                timeZone: "UTC",
              }),
            )}
            {info(t("code"), <bdi>{patient.code}</bdi>)}
          </dl>

          <div className="mt-4 flex items-end justify-between">
            <p className="text-[0.9em] font-semibold tracking-wide">{t("prescriptionTitle")}</p>
            {/* ℞ is written left-to-right, as on any prescription. */}
            <p className="text-[2.6em] leading-none font-bold" dir="ltr" aria-hidden>
              {"℞"}
            </p>
          </div>

          <ol
            className="mt-2 divide-y divide-dotted divide-slate-400"
            data-testid="prescription-items"
          >
            {prescription.items.map((item, index) => (
              <li key={item.id} className="break-inside-avoid py-2">
                <p className="text-[1.1em] font-bold" dir="ltr">
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
                    .join(" · ")}
                </p>
                {item.notes && <p className="ps-4 text-slate-700">{item.notes}</p>}
              </li>
            ))}
          </ol>

          {prescription.notes && (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 whitespace-pre-line">
              <span className="font-semibold">{t("notes")}: </span>
              {prescription.notes}
            </p>
          )}

          {/* Stamp and signature, at the bottom of the page */}
          <div className="mt-auto flex justify-end pt-6">
            <div className="text-center">
              <div
                className={cn(
                  "flex items-end justify-center rounded-md border border-black pb-1 text-[0.8em] text-slate-500",
                  a5 ? "h-[22mm] w-[48mm]" : "h-[28mm] w-[60mm]",
                )}
              >
                {t("stampAndSignature")}
              </div>
              {prescription.prescribedByName && (
                <p className="mt-1 font-semibold">{prescription.prescribedByName}</p>
              )}
            </div>
          </div>

          <footer className="mt-3 border-t-2 border-black pt-1.5 text-center text-[0.85em]">
            {contact.length > 0 && (
              <p>
                {contact.map((part, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <bdi>{part}</bdi>
                  </span>
                ))}
              </p>
            )}
            {letterhead.footer && (
              <p className="whitespace-pre-line text-slate-600">{letterhead.footer}</p>
            )}
          </footer>
        </div>
      </FitPage>
    </PaperSheet>
  )
}

import { IdCardIcon, StickyNoteIcon } from "lucide-react"
import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"

import { Panel } from "@/components/panel"
import { formatLocalPhone } from "@/lib/validation"

import { loadPatient } from "./load"

export async function generateMetadata({ params }: PageProps<"/patients/[id]">): Promise<Metadata> {
  const patient = await loadPatient((await params).id)
  return { title: patient.fullName }
}

export default async function PatientOverviewPage({ params }: PageProps<"/patients/[id]">) {
  const patient = await loadPatient((await params).id)
  const [t, format] = await Promise.all([getTranslations("patients"), getFormatter()])
  const dash = t("notSet")

  const rows: [string, React.ReactNode][] = [
    [
      t("code"),
      <span key="c" dir="ltr" className="font-mono">
        {patient.code}
      </span>,
    ],
    [
      t("birthDate"),
      patient.birthDate && !patient.birthDateEstimated
        ? format.dateTime(new Date(patient.birthDate), { dateStyle: "long", timeZone: "UTC" })
        : dash,
    ],
    [
      t("phone"),
      patient.phone ? (
        <span key="p" dir="ltr">
          {formatLocalPhone(patient.phone)}
        </span>
      ) : (
        dash
      ),
    ],
    [
      t("phone2"),
      patient.phone2 ? (
        <span key="p2" dir="ltr">
          {formatLocalPhone(patient.phone2)}
        </span>
      ) : (
        dash
      ),
    ],
    [t("address"), patient.address ?? dash],
    [t("referralSource"), patient.referralSource ?? dash],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel icon={IdCardIcon} title={t("details")} className="lg:col-span-2">
        <dl className="grid grid-cols-2 gap-3 md:gap-4">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          {t("registeredBy", {
            name: patient.createdByName ?? dash,
            date: format.dateTime(patient.createdAt, { dateStyle: "medium" }),
          })}
        </p>
      </Panel>

      <Panel icon={StickyNoteIcon} title={t("notes")}>
        {patient.notes ? (
          <p className="whitespace-pre-line text-slate-700">{patient.notes}</p>
        ) : (
          <p className="text-sm text-slate-400">{t("noNotes")}</p>
        )}
      </Panel>
    </div>
  )
}

import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageCircleIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react"
import type { Route } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import type { PatientDetails } from "../data"
import { ArchivePatientButton } from "./archive-patient-button"
import { BookPatientButton } from "./book-patient-button"
import { PatientAge } from "./patient-age"
import { formatLocalPhone } from "./patients-table"

/** A link styled as an icon button, with a hover tip (for tel: / WhatsApp links). */
function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon" className="bg-white shadow-sm">
          <a
            href={href}
            aria-label={label}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {children}
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Patient header in the clinic's design: back, big name + ID, details row, actions. */
export async function PatientHeader({
  patient,
  today,
  canEdit,
  canArchive,
}: {
  patient: PatientDetails
  today: string
  canEdit: boolean
  canArchive: boolean
}) {
  const [t, format] = await Promise.all([getTranslations("patients"), getFormatter()])
  const waNumber = patient.phone?.replace(/\D/g, "")

  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="flex items-start gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="mt-1 shrink-0 rounded-full bg-white"
            >
              <Link href="/patients" aria-label={t("backToList")}>
                {/* Back points right in RTL */}
                <ChevronRightIcon className="ltr:rotate-180" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("backToList")}</TooltipContent>
        </Tooltip>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {patient.fullName}
            </h2>
            <Badge variant="outline" dir="ltr" className="bg-white font-mono text-sm font-normal">
              {patient.code}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-4" aria-hidden />
              <PatientAge
                birthDate={patient.birthDate}
                estimated={patient.birthDateEstimated}
                today={today}
              />
              <span>· {t(patient.gender)}</span>
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="size-4" aria-hidden />
              {t("registeredOn", {
                date: format.dateTime(patient.createdAt, { dateStyle: "medium" }),
              })}
            </span>
            {patient.phone && (
              <span className="flex items-center gap-1">
                <PhoneIcon className="size-4" aria-hidden />
                <span dir="ltr">{formatLocalPhone(patient.phone)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {patient.phone && (
          <>
            <IconLink href={`tel:${patient.phone}`} label={t("call")}>
              <PhoneIcon />
            </IconLink>
            <IconLink href={`https://wa.me/${waNumber}`} label={t("whatsapp")}>
              <MessageCircleIcon />
            </IconLink>
          </>
        )}
        {canEdit && (
          <Button asChild variant="secondary" className="bg-white shadow-sm hover:bg-slate-100">
            <Link href={`/patients/${patient.id}/edit` as Route}>
              <PencilIcon />
              {t("edit")}
            </Link>
          </Button>
        )}
        {canArchive && <ArchivePatientButton id={patient.id} name={patient.fullName} />}
        <BookPatientButton
          patient={{ id: patient.id, fullName: patient.fullName, phone: patient.phone }}
        />
      </div>
    </header>
  )
}

import type { Route } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { PatientListRow } from "../data"
import { PatientAge } from "./patient-age"

export async function PatientsTable({ rows, today }: { rows: PatientListRow[]; today: string }) {
  const t = await getTranslations("patients")
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6">{t("patient")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("phone")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("age")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("gender")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} className="relative">
              <TableCell className="ps-6">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-blue-100 font-medium text-blue-700">
                      {p.fullName.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    {/* The link covers the whole row, so any cell opens the patient. */}
                    <Link
                      href={`/patients/${p.id}` as Route}
                      className="font-medium text-slate-900 after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                    >
                      {p.fullName}
                    </Link>
                    <p dir="ltr" className="text-end font-mono text-xs text-slate-500">
                      {p.code}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {p.phone ? <span dir="ltr">{formatLocalPhone(p.phone)}</span> : t("notSet")}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <PatientAge
                  birthDate={p.birthDate}
                  estimated={p.birthDateEstimated}
                  today={today}
                />
              </TableCell>
              <TableCell className="hidden md:table-cell">{t(p.gender)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** +9647701234567 → 0770 123 4567 (how Iraqis read numbers). */
export function formatLocalPhone(e164: string) {
  const m = /^\+964(\d{3})(\d{3})(\d{4})$/.exec(e164)
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164
}

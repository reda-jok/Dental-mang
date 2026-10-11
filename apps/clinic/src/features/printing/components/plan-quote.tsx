import { getFormatter, getTranslations } from "next-intl/server"

import type { PlanQuote as PlanQuoteData } from "@/features/plans/data"
import type { Letterhead } from "@/features/settings/data"
import { ageInYears, parseIsoDate } from "@/lib/dates"
import { formatMoney, fromMinor, toMinor } from "@/lib/money"
import { formatLocalPhone } from "@/lib/validation"

import {
  chairTime,
  chartDentition,
  paymentSchedule,
  type PaymentMode,
  type ScheduleLine,
} from "../quote"
import { FitPage } from "./fit-page"
import { PlanToothChart, type PlannedTooth } from "./plan-tooth-chart"
import { Amount, LetterheadBlock, PaperSheet } from "./sheets"

/** How long a printed quote's prices hold. */
export const QUOTE_VALID_DAYS = 30

export type QuotePayment = { mode: PaymentMode; months: number; depositPercent: number }

type Props = {
  plan: PlanQuoteData
  letterhead: Letterhead
  today: string
  /** Already paid toward the plan; null when the viewer can't see billing. */
  paid: string | null
  payment: QuotePayment
}

const money = (amount: string) => <Amount value={formatMoney(amount, "IQD")} />

/** Per-phase totals and the payment schedule both copies show. */
function planMoney(plan: PlanQuoteData, paid: string | null, payment: QuotePayment) {
  const phaseNet = plan.phases.map((phase) => ({
    phase,
    net: fromMinor(
      plan.items.filter((i) => i.phase === phase).reduce((s, i) => s + toMinor(i.net), 0n),
    ),
  }))
  const schedule = paymentSchedule({
    phases: phaseNet,
    paid: paid ?? "0",
    mode: payment.mode,
    months: payment.months,
    depositPercent: payment.depositPercent,
  })
  return {
    schedule,
    total: plan.total[0]?.amount ?? "0",
    discount: plan.discount[0]?.amount ?? "0",
  }
}

async function CopyHeader({
  letterhead,
  today,
  copy,
}: {
  letterhead: Letterhead
  today: string
  copy: string
}) {
  const t = await getTranslations("print")
  const format = await getFormatter()
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
      <LetterheadBlock letterhead={letterhead} align="start" />
      <div className="text-end">
        <p className="text-lg font-bold">{t("quoteTitle")}</p>
        <p className="text-[11px] font-semibold tracking-wide">{copy}</p>
        <p>{format.dateTime(parseIsoDate(today)!, { dateStyle: "long", timeZone: "UTC" })}</p>
      </div>
    </div>
  )
}

async function PatientDetails({ plan, today }: { plan: PlanQuoteData; today: string }) {
  const t = await getTranslations("print")
  const age = plan.patient.birthDate ? ageInYears(plan.patient.birthDate, today) : null
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
      <div className="flex gap-2">
        <dt className="text-slate-600">{t("patient")}:</dt>
        <dd className="font-semibold">{plan.patient.fullName}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-slate-600">{t("code")}:</dt>
        <dd>
          <bdi>{plan.patient.code}</bdi>
        </dd>
      </div>
      {age !== null && (
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("age")}:</dt>
          <dd>{t("years", { count: age })}</dd>
        </div>
      )}
      {plan.patient.phone && (
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("phone")}:</dt>
          <dd>
            <bdi>{formatLocalPhone(plan.patient.phone)}</bdi>
          </dd>
        </div>
      )}
      <div className="flex gap-2">
        <dt className="text-slate-600">{t("plan")}:</dt>
        <dd className="font-semibold">{plan.title}</dd>
      </div>
      {plan.createdByName && (
        <div className="flex gap-2">
          <dt className="text-slate-600">{t("dentist")}:</dt>
          <dd>{plan.createdByName}</dd>
        </div>
      )}
    </dl>
  )
}

async function ScheduleList({ lines, compact }: { lines: ScheduleLine[]; compact?: boolean }) {
  const t = await getTranslations("print")
  const label = (line: ScheduleLine) =>
    line.kind === "now"
      ? t("payNow")
      : line.kind === "deposit"
        ? t("payDeposit")
        : line.kind === "phase"
          ? t("payPhase", { phase: String(line.phase) })
          : t("payMonth", { month: String(line.month) })
  return (
    <ol
      className={compact ? "space-y-0.5" : "grid grid-cols-3 gap-x-4 gap-y-0.5"}
      data-testid="schedule"
    >
      {lines.map((line, i) => (
        <li key={i} className="flex justify-between gap-2" data-kind={line.kind}>
          <span>{label(line)}</span>
          {money(line.amount)}
        </li>
      ))}
    </ol>
  )
}

/** Totals block: discount, total, what's paid and what's left. */
async function Totals({
  total,
  discount,
  paid,
  remaining,
}: {
  total: string
  discount: string
  paid: string | null
  remaining: string
}) {
  const t = await getTranslations("print")
  return (
    <div className="ms-auto mt-2 w-64 space-y-0.5 border-t-2 border-black pt-1">
      {discount !== "0" && (
        <div className="flex justify-between">
          <span>{t("discount")}</span>
          {money(discount)}
        </div>
      )}
      <div className="flex justify-between text-base font-bold">
        <span>{t("total")}</span>
        <span data-testid="quote-total">{money(total)}</span>
      </div>
      {paid !== null && paid !== "0" && (
        <>
          <div className="flex justify-between">
            <span>{t("paidSoFar")}</span>
            {money(paid)}
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t("remaining")}</span>
            {money(remaining)}
          </div>
        </>
      )}
    </div>
  )
}

function chairTimeText(minutes: number, t: Awaited<ReturnType<typeof getTranslations<"print">>>) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts = [
    hours > 0 ? t("hours", { count: hours }) : null,
    rest > 0 ? t("minutes", { count: String(rest) }) : null,
  ].filter(Boolean)
  return t("chairTime", { time: parts.join(t("and")) })
}

/**
 * The copy the patient takes home: which teeth, in what order and how long, what each
 * treatment is, and how it can be paid. Always one page (FitPage): the explanations go
 * first when a plan is too big, then the page is scaled down.
 */
export async function PatientQuote({ plan, letterhead, today, paid, payment }: Props) {
  const t = await getTranslations("print")
  const tp = await getTranslations("plans")
  const { schedule, total, discount } = planMoney(plan, paid, payment)
  const minutes = chairTime(plan.items)
  const discounts = plan.items.some((item) => item.discount !== "0")
  const columns = discounts ? 5 : 3

  // Each tooth shows its next unfinished phase, or a tick once everything on it is done.
  const byTooth = Map.groupBy(
    plan.items.filter((i) => i.tooth !== null),
    (i) => i.tooth!,
  )
  const planned = new Map<number, PlannedTooth>()
  for (const [tooth, items] of byTooth) {
    const open = items.filter((i) => i.status !== "done")
    planned.set(tooth, {
      phase: Math.min(...(open.length ? open : items).map((i) => i.phase)),
      done: open.length === 0,
    })
  }

  const age = plan.patient.birthDate ? ageInYears(plan.patient.birthDate, today) : null
  const dentition = chartDentition(age, [...planned.keys()])

  const explained = [
    ...new Map(
      plan.items.filter((i) => i.patientNote).map((i) => [i.procedureId, i] as const),
    ).values(),
  ]
  const dueAtPhase = new Map(
    schedule.lines.flatMap((l) => (l.kind === "phase" ? [[l.phase, l.amount] as const] : [])),
  )

  return (
    <PaperSheet paper={letterhead.paper}>
      <FitPage paper={letterhead.paper}>
        <div data-copy="patient">
          <CopyHeader letterhead={letterhead} today={today} copy={t("patientCopy")} />
          <PatientDetails plan={plan} today={today} />

          {planned.size > 0 && (
            <PlanToothChart
              dentition={dentition}
              planned={planned}
              showPhases={plan.phases.length > 1}
            />
          )}

          <table className="mt-2 w-full border-collapse text-start" data-testid="timeline">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-0.5 text-start font-semibold">{t("procedure")}</th>
                <th className="w-12 py-0.5 text-start font-semibold">{tp("tooth")}</th>
                {discounts && (
                  <>
                    <th className="w-24 py-0.5 text-end font-semibold">{t("price")}</th>
                    <th className="w-20 py-0.5 text-end font-semibold">{t("discount")}</th>
                  </>
                )}
                <th className="w-24 py-0.5 text-end font-semibold">{t("net")}</th>
              </tr>
            </thead>
            {plan.phases.map((phase, index) => {
              const items = plan.items.filter((item) => item.phase === phase)
              const done = items.every((i) => i.status === "done")
              const time = minutes.get(phase) ?? 0
              return (
                <tbody key={phase} className="break-inside-avoid" data-phase={phase}>
                  <tr>
                    <td colSpan={columns} className="pt-1.5 pb-0.5">
                      <span className="me-2 inline-flex size-4 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="font-semibold">
                        {plan.phases.length > 1
                          ? tp("phase", { phase: String(phase) })
                          : t("treatmentStep")}
                      </span>
                      {time > 0 && (
                        <span className="text-slate-600"> · {chairTimeText(time, t)}</span>
                      )}
                      {done && <span className="font-semibold"> · {t("phaseDone")}</span>}
                      {dueAtPhase.has(phase) && (
                        <span className="text-slate-600">
                          {" "}
                          · {t("dueAtPhase")} {money(dueAtPhase.get(phase)!)}
                        </span>
                      )}
                    </td>
                  </tr>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-300">
                      <td className="py-0.5">
                        {item.status === "done" && <span aria-hidden>{"✓ "}</span>}
                        {item.procedureName}
                      </td>
                      <td className="py-0.5">
                        {item.tooth !== null && (
                          <bdi>{`${item.tooth}${item.surfaces.length ? ` ${item.surfaces.join("")}` : ""}`}</bdi>
                        )}
                      </td>
                      {discounts && (
                        <>
                          <td className="py-0.5 text-end">{money(item.price)}</td>
                          <td className="py-0.5 text-end">
                            {item.discount === "0" ? "—" : money(item.discount)}
                          </td>
                        </>
                      )}
                      <td className="py-0.5 text-end font-medium">{money(item.net)}</td>
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>

          <Totals total={total} discount={discount} paid={paid} remaining={schedule.remaining} />

          <section className="mt-2 break-inside-avoid rounded border border-black px-2 py-1">
            <p className="font-semibold">{t("paymentTitle")}</p>
            {schedule.lines.length === 0 ? (
              <p>{t("fullyPaid")}</p>
            ) : (
              <ScheduleList lines={schedule.lines} />
            )}
          </section>

          {explained.length > 0 && (
            <section className="mt-2 break-inside-avoid" data-testid="explanations" data-optional>
              <p className="font-semibold">{t("explanationsTitle")}</p>
              <dl className="mt-1 space-y-0.5 text-[0.92em]">
                {explained.map((item) => (
                  <div key={item.procedureId}>
                    <dt className="inline font-semibold">{item.procedureName}: </dt>
                    <dd className="inline">{item.patientNote}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {plan.notes && (
            <p className="mt-2 whitespace-pre-line">
              <span className="font-semibold">{t("notes")}: </span>
              {plan.notes}
            </p>
          )}

          <p className="mt-2 text-[0.85em] text-slate-700">
            {t("quoteValid", { days: String(QUOTE_VALID_DAYS) })} {t("quoteCurrency")}{" "}
            {t("quoteMayChange")}
          </p>

          {letterhead.footer && (
            <p className="mt-2 text-center text-[0.85em] whitespace-pre-line text-slate-600">
              {letterhead.footer}
            </p>
          )}
        </div>
      </FitPage>
    </PaperSheet>
  )
}

/** The copy the clinic keeps: what was agreed, the payment terms, and both signatures. */
export async function ClinicCopy({ plan, letterhead, today, paid, payment }: Props) {
  const t = await getTranslations("print")
  const tp = await getTranslations("plans")
  const { schedule, total, discount } = planMoney(plan, paid, payment)

  return (
    <PaperSheet paper={letterhead.paper}>
      <FitPage paper={letterhead.paper}>
        <div data-copy="clinic">
          <CopyHeader letterhead={letterhead} today={today} copy={t("clinicCopy")} />
          <PatientDetails plan={plan} today={today} />

          <table className="mt-2 w-full border-collapse text-start">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-0.5 text-start font-semibold">{t("procedure")}</th>
                <th className="w-12 py-0.5 text-start font-semibold">{tp("tooth")}</th>
                <th className="w-24 py-0.5 text-end font-semibold">{t("net")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="py-0.5">
                    {plan.phases.length > 1 && (
                      <span className="text-slate-600">
                        {tp("phase", { phase: String(item.phase) })} ·{" "}
                      </span>
                    )}
                    {item.procedureName}
                  </td>
                  <td className="py-0.5">
                    {item.tooth !== null && (
                      <bdi>{`${item.tooth}${item.surfaces.length ? ` ${item.surfaces.join("")}` : ""}`}</bdi>
                    )}
                  </td>
                  <td className="py-0.5 text-end">{money(item.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Totals total={total} discount={discount} paid={paid} remaining={schedule.remaining} />

          <section className="mt-2 break-inside-avoid">
            <p className="mb-1 font-semibold">{t("paymentAgreed")}</p>
            {schedule.lines.length === 0 ? (
              <p>{t("fullyPaid")}</p>
            ) : (
              <ScheduleList lines={schedule.lines} compact={schedule.lines.length <= 4} />
            )}
          </section>

          <p className="mt-4 font-medium">{t("consent")}</p>

          <div className="mt-10 grid grid-cols-2 gap-10 text-center">
            <div className="border-t border-black pt-1.5">{t("dentistSignature")}</div>
            <div className="border-t border-black pt-1.5">{t("patientSignature")}</div>
          </div>
          <p className="mt-6">
            {t("date")}: <span className="inline-block w-40 border-b border-black" />
          </p>
        </div>
      </FitPage>
    </PaperSheet>
  )
}

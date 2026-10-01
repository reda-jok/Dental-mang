// The demo clinic: staff, catalog, patients and ~5 months of history (charts, plans,
// appointments, invoices, payments, refunds, voids) up to today, plus two weeks of
// upcoming appointments. Run through prisma/demo/index.ts (`pnpm --filter clinic db:demo`).
//
// Clinical rows are written directly; every money operation goes through the real billing
// services (with a past clock), so journal entries, allocations and audit rows are exactly
// what the app itself produces.
//
// Keep this file in step with the app: every new feature adds its demo data here.

import { hashPassword } from "better-auth/crypto"

import { summarize } from "@/features/billing/cash"
import {
  closeCashSchema,
  createInvoiceSchema,
  paymentReminderSchema,
  recordPaymentSchema,
  refundSchema,
  voidInvoiceSchema,
  voidPaymentSchema,
} from "@/features/billing/schemas"
import {
  closeCashDrawer,
  createInvoice,
  logPaymentReminder,
  recordPayment,
  refundPatient,
  voidInvoice,
  unclosedMovements,
  voidPayment,
  type Clock,
} from "@/features/billing/service"
import { createLabCaseSchema } from "@/features/lab/schemas"
import { createLabCase, stepLabCase } from "@/features/lab/service"
import { buildSearchText } from "@/features/patients/search"
import { shouldCompletePlan } from "@/features/plans/rules"
import { createPrescriptionSchema } from "@/features/prescriptions/schemas"
import { createPrescription } from "@/features/prescriptions/service"
import { STARTER_MEDICATIONS } from "@/features/prescriptions/starter"
import { STARTER_CATALOG } from "@/features/procedures/starter"
import { addDays, todayIso, weekdayOf, zonedInstant } from "@/lib/dates"
import { fromMinor, toMinor } from "@/lib/money"
import { db } from "@/server/db"
import { detectFileType, saveUpload } from "@/server/storage"
import type { CurrentUser } from "@/server/session"

import {
  AREAS,
  BACK_TEETH,
  CLINIC,
  CONDITIONS,
  ALLERGIES,
  FAMILY,
  FEMALE,
  FRONT_TEETH,
  MALE,
  MOLARS,
  PASSWORD,
  PRICES,
  REFERRALS,
  ROOMS,
  STAFF,
} from "./data"
import { intraoralPhoto, panoramicXray, periapicalXray, referralPdf } from "./images"
import { chance, int, pick, rand, weighted } from "./random"

const TZ = "Asia/Baghdad"
const HISTORY_DAYS = 150 // long enough for debts overdue 90+ days
const UPCOMING_DAYS = 14
const DAY_START = 15 * 60 + 30 // 3:30 pm, the clinic's default opening time
const SLOT = 30

type Method = "cash" | "card" | "wallet"
type Payer = "prompt" | "partial" | "late" | "never"
type ItemSpec = {
  procedure: string
  tooth: number | null
  surfaces: string[]
  phase: number
  finding?: { condition: string; surfaces: string[] }
}
type Template =
  "fillings" | "rootCanal" | "extraction" | "hygiene" | "whitening" | "implant" | "ortho"
type PatientState = {
  id: string
  template: Template
  specs: ItemSpec[]
  payer: Payer
  planId: string | null
  /** Plan billed up front at the first visit (implant, ortho), paid in installments. */
  upFront: boolean
}
type Visit = { patientId: string; rebooked?: boolean }
type ScheduledPayment = { patientId: string; amount: bigint | "balance"; method?: Method }

const today = todayIso(TZ)
const start = addDays(today, -HISTORY_DAYS)
const last = addDays(today, UPCOMING_DAYS)
/** Days with a cash-close difference in the last two weeks (see closeDrawer). */
const recentShort = nextOpen(addDays(today, -4))
const recentOver = nextOpen(addDays(today, -11))

const counts = {
  invoices: 0,
  payments: 0,
  voidedInvoices: 0,
  voidedPayments: 0,
  refunds: 0,
  closes: 0,
  files: 0,
}

/** Clinic-time moment on `day` at `minutes` after midnight. */
const clockAt = (day: string, minutes = 21 * 60): Clock => ({
  day,
  at: zonedInstant(day, minutes, TZ),
})

const dinars = (minor: bigint) => fromMinor(minor)
/** Rounds down to whole thousands of dinars (how people pay). */
const roundThousands = (minor: bigint) => (minor / 100_000n) * 100_000n

/**
 * "fresh": an empty database (the separate demo database).
 * "into": an existing clinic (e.g. the development database): its settings, owner
 * account, catalog and patients are kept and used; only what's missing is added.
 */
export type SeedMode = "fresh" | "into"

export async function seedDemo(options: { patients: number; mode: SeedMode }) {
  // The history is added once per database; newer features add their own demo data on
  // top (topUps), so a database seeded earlier catches up by running the seed again.
  const seeded = await db.user.findUnique({ where: { username: "sara" }, select: { id: true } })
  if (seeded) console.log("Demo history already present: adding newer features' demo data only.")
  else await seedHistory(options)
  await topUps()
}

/**
 * Demo data for features built after a database was first seeded. Each step checks
 * whether its data is already there.
 */
async function topUps() {
  await seedPrescriptions()
  await seedLabCases()
}

const LAB_WORK: Record<string, { cost: number; material: string }> = {
  "تاج زيركون": { cost: 75_000, material: "zirconia" },
  "تاج بورسلين على معدن": { cost: 45_000, material: "pfm" },
  "جسر (لكل سن)": { cost: 60_000, material: "zirconia" },
  فينير: { cost: 70_000, material: "emax" },
  "طقم كامل": { cost: 150_000, material: "acrylic" },
}

/**
 * Lab work (2026-10-01): three labs, and a case for each crown, bridge, veneer and
 * denture in the plans: fitted for finished treatment, at the lab (some late) or
 * waiting to be fitted for open treatment, with a few remakes and cancellations.
 */
async function seedLabCases() {
  if ((await db.lab.count()) === 0) {
    await db.lab.createMany({
      data: [
        {
          name: "مختبر الرافدين للأسنان",
          phone: "+9647701112233",
          contactName: "أبو أحمد",
          turnaroundDays: 7,
        },
        {
          name: "مختبر بغداد الرقمي",
          phone: "+9647801234321",
          contactName: "م. سيف",
          turnaroundDays: 5,
          notes: "زيركون وإيماكس بالتصميم الرقمي (CAD/CAM)",
        },
        {
          name: "مختبر النخبة للأطقم",
          phone: "+9647509876543",
          contactName: "حجي كريم",
          turnaroundDays: 10,
        },
      ],
    })
  }
  if ((await db.labCase.count()) > 0) return
  const labs = await db.lab.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, turnaroundDays: true },
  })
  const today = todayIso(TZ)
  const items = await db.treatmentPlanItem.findMany({
    where: {
      procedure: { requiresLab: true, name: { in: Object.keys(LAB_WORK) } },
      plan: {
        status: { in: ["accepted", "completed", "cancelled"] },
        patient: { deletedAt: null },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      tooth: true,
      status: true,
      completedAt: true,
      createdAt: true,
      dentistId: true,
      procedure: { select: { name: true } },
      plan: { select: { patientId: true, status: true, createdById: true } },
    },
  })
  const dentistIds = [
    ...new Set(items.flatMap((i) => [i.dentistId, i.plan.createdById]).filter(Boolean)),
  ] as string[]
  const users = new Map(
    (
      await db.user.findMany({
        where: { id: { in: dentistIds } },
        select: { id: true, name: true, username: true },
      })
    ).map((u) => [u.id, u]),
  )
  const counts = { fitted: 0, open: 0, cancelled: 0 }
  for (const item of items) {
    const work = item.procedure.name
    const lab =
      work === "طقم كامل"
        ? (labs[2] ?? labs[0]!)
        : work === "تاج بورسلين على معدن"
          ? labs[0]!
          : pick(labs.slice(0, 2))
    const dentistId = item.dentistId ?? item.plan.createdById
    const user = dentistId ? users.get(dentistId) : null
    if (!user) continue
    const actor: CurrentUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: "dentist",
    }
    const planDay = toDay(item.createdAt)
    let sentOn: string
    let steps: Parameters<typeof stepLabCase>[1][] = []
    if (item.status === "done" && item.completedAt) {
      const fittedOn = toDay(item.completedAt)
      const receivedOn = addDays(fittedOn, -int(1, 2))
      sentOn = maxDay(planDay, addDays(receivedOn, -(lab.turnaroundDays + int(-1, 2))))
      if (sentOn > receivedOn) continue
      // Now and then the first delivery was sent back and redone.
      const firstDelivery = addDays(receivedOn, -5)
      steps =
        chance(0.08) && firstDelivery > sentOn
          ? [
              { action: "receive", id: "", date: firstDelivery },
              { action: "remake", id: "", dueOn: receivedOn, reason: "اللون غير مطابق" },
              { action: "receive", id: "", date: receivedOn },
            ]
          : [{ action: "receive", id: "", date: receivedOn }]
      steps.push({ action: "fit", id: "", date: fittedOn })
      counts.fitted++
    } else if (item.plan.status === "cancelled") {
      if (!chance(0.5)) continue
      sentOn = minDay(today, addDays(planDay, 1))
      steps = [{ action: "cancel", id: "", reason: "المريض أجّل العلاج" }]
      counts.cancelled++
    } else if (item.status === "planned" || item.status === "in_progress") {
      sentOn = minDay(today, addDays(planDay, int(1, 12)))
      const expected = addDays(sentOn, lab.turnaroundDays)
      if (expected < today && chance(0.6)) {
        steps = [{ action: "receive", id: "", date: minDay(today, addDays(expected, int(-1, 2))) }]
      }
      counts.open++
    } else {
      continue
    }
    const created = await createLabCase(
      actor,
      createLabCaseSchema.parse({
        patientId: item.plan.patientId,
        labId: lab.id,
        dentistId: user.id,
        planItemId: item.id,
        work,
        teeth: item.tooth ? String(item.tooth) : "",
        shade: work === "طقم كامل" ? "A3" : pick(["A1", "A2", "A2", "A3", "B1", "B2"]),
        material: LAB_WORK[work]!.material,
        instructions: chance(0.3)
          ? pick(["حواف كتفية", "تجربة قبل التلميع النهائي", "تطابق اللون مع السن المجاور"])
          : "",
        cost: String(LAB_WORK[work]!.cost),
        sentOn,
        dueOn: addDays(sentOn, lab.turnaroundDays),
      }),
    )
    for (const step of steps) await stepLabCase(actor, { ...step, id: created.id } as never)
  }
  console.log(
    `Lab: ${labs.length} labs, ${counts.fitted} fitted, ${counts.open} open, ${counts.cancelled} cancelled.`,
  )
}

const toDay = (instant: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(instant)
const maxDay = (a: string, b: string) => (a > b ? a : b)
const minDay = (a: string, b: string) => (a < b ? a : b)

/**
 * Prescriptions (2026-10-01): the starter medicines list, and a prescription after each
 * past extraction, root canal and implant, by the dentist who did it, chosen around the
 * patient's recorded allergies and conditions.
 */
async function seedPrescriptions() {
  if ((await db.medication.count()) === 0) {
    await db.medication.createMany({
      data: STARTER_MEDICATIONS.map((m, index) => ({
        ...m,
        duration: m.duration || null,
        group: m.group ?? null,
        sortOrder: index,
      })),
    })
  }
  if ((await db.prescription.count()) > 0) return
  const meds = new Map(
    (
      await db.medication.findMany({
        select: { id: true, name: true, dose: true, frequency: true, duration: true },
      })
    ).map((m) => [m.name, m]),
  )
  const line = (name: string) => {
    const m = meds.get(name)!
    return {
      medicationId: m.id,
      name: m.name,
      dose: m.dose ?? "",
      frequency: m.frequency ?? "",
      duration: m.duration ?? "",
    }
  }

  const visits = await db.$queryRaw<
    { patient_id: string; day: string; dentist_id: string; dentist_name: string; kind: string }[]
  >`
    select distinct on (p.patient_id, (i.completed_at at time zone 'Asia/Baghdad')::date)
      p.patient_id, to_char((i.completed_at at time zone 'Asia/Baghdad')::date, 'YYYY-MM-DD') as day,
      i.dentist_id, u.name as dentist_name,
      case when pr.name like 'قلع%' then 'extraction' when pr.name like 'زرعة%' then 'implant' else 'rootCanal' end as kind
    from treatment_plan_item i
    join treatment_plan p on p.id = i.plan_id
    join procedure pr on pr.id = i.procedure_id
    join "user" u on u.id = i.dentist_id
    where i.status = 'done' and i.completed_at is not null
      and (pr.name like 'قلع%' or pr.name like 'زرعة%' or pr.name like 'علاج عصب%' or pr.name like 'إعادة علاج عصب%')
    order by p.patient_id, (i.completed_at at time zone 'Asia/Baghdad')::date`
  let written = 0
  for (const visit of visits) {
    const history = await db.medicalHistory.findFirst({
      where: { patientId: visit.patient_id },
      orderBy: { version: "desc" },
      select: { allergies: true, conditions: true },
    })
    const allergies = history?.allergies ?? []
    const conditions = history?.conditions ?? []
    const noNsaids =
      allergies.includes("nsaids") ||
      conditions.some((c) =>
        ["anticoagulants", "bleeding_disorder", "kidney_disease", "asthma"].includes(c),
      )
    const items = [
      line(
        allergies.includes("penicillin")
          ? "Clindamycin 300 mg"
          : pick(["Amoxicillin 500 mg", "Amoxicillin / Clavulanic acid 625 mg"]),
      ),
      line(noNsaids ? "Paracetamol 500 mg" : pick(["Ibuprofen 400 mg", "Ibuprofen 600 mg"])),
      ...(visit.kind !== "rootCanal" && !allergies.includes("chlorhexidine") && chance(0.6)
        ? [line("Chlorhexidine 0.12% mouthwash")]
        : []),
    ]
    await createPrescription(
      { id: visit.dentist_id, name: visit.dentist_name, username: null, role: "dentist" },
      createPrescriptionSchema.parse({
        patientId: visit.patient_id,
        items,
        notes:
          visit.kind === "extraction"
            ? "عض على الشاش نصف ساعة. لا تمضمض ولا تأكل شيئاً ساخناً اليوم."
            : visit.kind === "implant"
              ? "كمادات باردة على الخد أول يوم. طعام لين لثلاثة أيام."
              : "",
        acknowledged: [],
      }),
      visit.day,
    )
    written++
  }
  console.log(`Prescriptions: ${meds.size} medicines, ${written} prescriptions.`)
}

async function seedHistory({ patients: patientCount, mode }: { patients: number; mode: SeedMode }) {
  console.log(`Demo clinic (${mode}): ${patientCount} patients, ${HISTORY_DAYS} days of history…`)

  // ─── Clinic, staff, rooms, days off ────────────────────────────────────────
  const settings = await db.clinicSettings.findUnique({
    where: { id: 1 },
    select: { phone: true, address: true, receiptFooter: true },
  })
  if (!settings) {
    await db.clinicSettings.create({ data: { id: 1, ...CLINIC, invoiceDueDays: 30 } })
  } else {
    // Keep the clinic's own settings; fill only what's empty so printouts are complete.
    await db.clinicSettings.update({
      where: { id: 1 },
      data: {
        phone: settings.phone ?? CLINIC.phone,
        address: settings.address ?? CLINIC.address,
        receiptFooter: settings.receiptFooter ?? CLINIC.receiptFooter,
      },
    })
  }

  const passwordHash = await hashPassword(PASSWORD)
  const createUser = async (
    member: { username: string; name: string; role: string },
    extra: { banned?: boolean; banReason?: string } = {},
  ) => {
    const user = await db.user.create({
      data: {
        name: member.name,
        email: `${member.username}@staff.clinic.local`,
        emailVerified: true,
        username: member.username,
        displayUsername: member.username,
        role: member.role,
        createdAt: zonedInstant(addDays(start, -30), 10 * 60, TZ),
        ...extra,
      },
    })
    await db.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    })
    return user
  }
  const staff = {} as Record<(typeof STAFF)[number]["username"], CurrentUser>
  for (const member of STAFF) {
    // An existing owner (the clinic's own account) plays the owner.
    const existing =
      member.role === "owner"
        ? await db.user.findFirst({
            where: { role: "owner" },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, username: true },
          })
        : null
    const user = existing ?? (await createUser(member))
    staff[member.username] = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: member.role,
    }
  }
  // A former employee whose account was disabled (Settings → Users).
  await createUser(
    { username: "ali.old", name: "علي الموظف السابق", role: "reception" },
    { banned: true, banReason: "ترك العمل" },
  )
  const dentists = [staff.sara, staff.haider]
  const { owner, reem: reception } = staff

  const rooms = []
  for (const [sortOrder, name] of ROOMS.entries()) {
    rooms.push(
      (await db.room.findUnique({ where: { name } })) ??
        (await db.room.create({ data: { name, sortOrder } })),
    )
  }

  const holidays = new Set([nextOpen(addDays(start, 20)), nextOpen(addDays(today, 9))])
  for (const date of holidays) {
    await db.clinicHoliday.upsert({
      where: { date: new Date(`${date}T00:00:00Z`) },
      create: {
        date: new Date(`${date}T00:00:00Z`),
        reason: "عطلة رسمية",
        createdById: owner.id,
      },
      update: {},
    })
  }

  // The owner lets reception give discounts (Settings → Permissions).
  await db.rolePermission.upsert({
    where: { role_permission: { role: "reception", permission: "billing:discount" } },
    create: {
      role: "reception",
      permission: "billing:discount",
      granted: true,
      updatedById: owner.id,
    },
    update: { granted: true },
  })

  // ─── Catalog with prices (existing procedures keep their price unless unset) ─
  const procedures = new Map<string, { id: string; price: string }>()
  for (const [index, group] of STARTER_CATALOG.entries()) {
    const category = await db.procedureCategory.upsert({
      where: { name: group.category },
      create: { name: group.category, sortOrder: index },
      update: {},
    })
    for (const p of group.procedures) {
      const price = String(PRICES[p.name] ?? 0)
      const existing = await db.procedure.findFirst({
        where: { categoryId: category.id, name: p.name },
        select: { id: true, price: true },
      })
      if (existing) {
        const unset = existing.price.toString() === "0"
        if (unset) await db.procedure.update({ where: { id: existing.id }, data: { price } })
        procedures.set(p.name, {
          id: existing.id,
          price: unset ? price : existing.price.toString(),
        })
      } else {
        const created = await db.procedure.create({
          data: { ...p, categoryId: category.id, price, currency: "IQD", createdById: owner.id },
        })
        procedures.set(p.name, { id: created.id, price })
      }
    }
  }

  // ─── Patients ──────────────────────────────────────────────────────────────
  // Existing patients are used first (an existing clinic); more are created if needed.
  const pool =
    mode === "into"
      ? await db.patient.findMany({
          where: { deletedAt: null },
          orderBy: { code: "asc" },
          take: patientCount,
          select: { id: true, gender: true, birthDate: true },
        })
      : []
  // Most patients come in during the history window; the rest are older records.
  const activeCount = Math.min(Math.round(patientCount * 0.85), 600)
  const states: PatientState[] = []
  const agenda = new Map<string, Visit[]>()
  const payments = new Map<string, ScheduledPayment[]>()

  for (let i = 0; i < patientCount; i++) {
    const active = i < activeCount
    // Active patients come in for treatment during the history window; some are booked
    // for today and the coming two weeks, so the calendar ahead isn't empty.
    const firstDay = !active
      ? null
      : chance(0.15)
        ? chance(0.12)
          ? today
          : openDayBetween(addDays(today, 1), UPCOMING_DAYS - 1)
        : openDayBetween(start, HISTORY_DAYS - 1)
    // Registered at the first visit (or a few days ago for visits still to come).
    const registeredOn = !firstDay
      ? addDays(start, -int(1, 200))
      : firstDay > today
        ? addDays(today, -int(0, 3))
        : firstDay
    const existing = pool[i]
    const id = existing ? existing.id : await createPatient(registeredOn)
    if (existing) await ensureMedicalHistory(existing, registeredOn)
    if (!active) continue

    // Some histories are updated later (a new medicine, a new condition).
    if (firstDay! < today && chance(0.08)) {
      await updateMedicalHistory(id, nextOpen(addDays(firstDay!, int(10, 40))))
    }

    const template = weighted<Template>([
      ["fillings", 35],
      ["hygiene", 20],
      ["rootCanal", 15],
      ["extraction", 12],
      ["whitening", 5],
      ["implant", 7],
      ["ortho", 6],
    ])
    const state: PatientState = {
      id,
      template,
      specs: planSpecs(template),
      payer: weighted<Payer>([
        ["prompt", 65],
        ["partial", 15],
        ["late", 12],
        ["never", 8],
      ]),
      planId: null,
      upFront: template === "implant" || template === "ortho",
    }
    states.push(state)
    schedule(agenda, firstDay!, { patientId: id })

    // A few patients leave a deposit a few days before their first visit.
    if (chance(0.05) && firstDay! > addDays(start, 5) && firstDay! <= today) {
      queuePayment(payments, nextOpen(addDays(firstDay!, -int(2, 5))), {
        patientId: id,
        amount: toMinor(pick(["50000", "100000"])),
      })
    }
  }
  const stateById = new Map(states.map((s) => [s.id, s]))

  // ─── Day by day ────────────────────────────────────────────────────────────
  let invoiceSerial = 0
  let paymentSerial = 0
  let refundsLeft = 2

  for (let day = start; day <= last; day = addDays(day, 1)) {
    if (!isOpen(day)) {
      // Anything booked or due on a closed day moves to the next open day.
      const after = nextOpen(addDays(day, 1))
      for (const visit of agenda.get(day) ?? []) schedule(agenda, after, visit)
      for (const due of payments.get(day) ?? []) queuePayment(payments, after, due)
      agenda.delete(day)
      payments.delete(day)
      continue
    }

    // Money that comes in on its own (deposits, installments, late payers).
    if (day <= today) {
      for (const due of payments.get(day) ?? []) await collect(due, day)
    }

    const visits = agenda.get(day) ?? []
    // Two dentists, one chair each, 13 half-hour slots: extra bookings move to the next day.
    const capacity = 26
    for (const extra of visits.splice(capacity)) schedule(agenda, nextOpen(addDays(day, 1)), extra)

    const booked = visits.length
    for (const [slot, visit] of visits.entries()) {
      const state = stateById.get(visit.patientId)!
      const dentist = dentists[slot % 2]!
      const room = rooms[slot % 2]!
      const startMin = DAY_START + Math.floor(slot / 2) * SLOT
      const status =
        day < today
          ? weighted([
              ["completed", 85],
              ["no_show", 8],
              ["cancelled", 7],
            ] as const)
          : day === today
            ? slot < booked / 2
              ? "completed"
              : slot === Math.ceil(booked / 2)
                ? "in_progress"
                : "pending"
            : "pending"

      // The booking shows the next treatment due.
      const nextProcedure = state.planId
        ? await nextPlanned(state.planId)
        : procedures.get(state.specs[0]!.procedure)!.id
      await db.appointment.create({
        data: {
          patientId: state.id,
          dentistId: dentist.id,
          roomId: room.id,
          procedureId: nextProcedure,
          startsAt: zonedInstant(day, startMin, TZ),
          endsAt: zonedInstant(day, startMin + SLOT, TZ),
          status,
          priority: chance(0.05) ? "urgent" : "normal",
          notes: visit.rebooked ? "موعد بديل" : null,
          createdById: reception.id,
          createdAt: zonedInstant(addDays(day, -int(1, 10)), 16 * 60, TZ),
        },
      })

      if (status === "no_show" || status === "cancelled") {
        schedule(agenda, nextOpen(addDays(day, int(3, 10))), { ...visit, rebooked: true })
        continue
      }
      if (status !== "completed") continue

      const clock = clockAt(day, startMin + SLOT)
      if (!state.planId) await createPlan(state, dentist, day)
      const done = await treat(state, dentist, clock.at)

      // Bill what was done. The last visits of today are left for reception to bill.
      const leaveUnbilled = day === today && slot >= booked / 2 - 2
      if (state.upFront && done.firstVisit) {
        await billPlanUpFront(state, day, payments)
      } else if (done.items > 0 && !leaveUnbilled && !state.upFront) {
        await billVisit(state, day, payments)
      }

      // Book the next visit while treatment remains.
      const remaining = await db.treatmentPlanItem.count({
        where: { planId: state.planId!, status: { in: ["planned", "in_progress"] } },
      })
      if (remaining > 0) {
        const gap =
          state.template === "ortho"
            ? int(28, 35)
            : state.template === "implant"
              ? int(40, 60)
              : int(7, 21)
        schedule(agenda, nextOpen(addDays(day, gap)), { patientId: state.id })
      }
    }

    // End of the day: reception counts the drawer. Today is left open to try it.
    if (day < today) await closeDrawer(day)
  }

  // ─── Payment reminders (debts page) ────────────────────────────────────────
  // Most late payers were reminded on WhatsApp once or more since their invoice fell due.
  const late = await db.$queryRaw<{ patient_id: string; oldest: string }[]>`
    select i.patient_id, to_char(min(i.due_date), 'YYYY-MM-DD') as oldest
    from invoice i
    cross join lateral (
      select coalesce(sum(a.amount), 0) as paid from payment_allocation a
      join payment p on p.id = a.payment_id
      where a.invoice_id = i.id and p.voided_at is null) x
    where i.status = 'issued' and i.total > x.paid and i.due_date < ${today}::date
    group by i.patient_id
    order by i.patient_id`
  let reminders = 0
  for (const row of late) {
    if (!chance(0.65)) continue
    let day = nextOpen(addDays(row.oldest, int(2, 6)))
    for (let k = int(1, 3); k > 0 && day < today; k--) {
      await logPaymentReminder(
        reception,
        paymentReminderSchema.parse({ patientId: row.patient_id }),
        clockAt(day, DAY_START + 20),
      )
      reminders++
      day = nextOpen(addDays(day, int(7, 20)))
    }
  }

  const summary = await Promise.all([
    db.patient.count(),
    db.appointment.count(),
    db.treatmentPlan.count(),
    db.invoice.count(),
    db.payment.count(),
    db.refund.count(),
    db.journalEntry.count(),
  ])
  console.log(`Payment reminders: ${reminders} to ${late.length} late patients.`)
  console.log(`Cash closes: ${counts.closes} days (today left open). Files: ${counts.files}.`)
  console.log(
    `Done: ${summary[0]} patients, ${summary[1]} appointments, ${summary[2]} plans, ` +
      `${summary[3]} invoices (${counts.voidedInvoices} void), ${summary[4]} payments ` +
      `(${counts.voidedPayments} void), ${summary[5]} refunds, ${summary[6]} journal entries.`,
  )

  // ─── Helpers that use this run's state ─────────────────────────────────────

  async function createPlan(state: PatientState, dentist: CurrentUser, day: string) {
    const createdAt = zonedInstant(day, DAY_START, TZ)
    const plan = await db.treatmentPlan.create({
      data: {
        patientId: state.id,
        title: PLAN_TITLES[state.template],
        status: "accepted",
        acceptedAt: createdAt,
        createdById: dentist.id,
        createdAt,
      },
    })
    state.planId = plan.id
    for (const spec of state.specs) {
      const procedure = procedures.get(spec.procedure)!
      await db.treatmentPlanItem.create({
        data: {
          planId: plan.id,
          procedureId: procedure.id,
          tooth: spec.tooth,
          surfaces: spec.surfaces,
          phase: spec.phase,
          price: procedure.price,
          currency: "IQD",
          createdAt,
        },
      })
      if (spec.finding && spec.tooth) {
        await db.toothFinding.create({
          data: {
            patientId: state.id,
            tooth: spec.tooth,
            surfaces: spec.finding.surfaces,
            condition: spec.finding.condition,
            recordedById: dentist.id,
            createdAt,
          },
        })
      }
    }
    await firstExamExtras(state, dentist, day, createdAt)
  }

  /**
   * What else a first exam records: old dental work on the chart, X-rays / photos /
   * documents, and sometimes a second plan the patient is still thinking about (or
   * turned down).
   */
  async function firstExamExtras(
    state: PatientState,
    dentist: CurrentUser,
    day: string,
    createdAt: Date,
  ) {
    const planned = new Set(state.specs.map((s) => s.tooth))
    if (chance(0.45)) {
      for (let k = int(1, 3); k > 0; k--) {
        const tooth = pick([...BACK_TEETH, ...FRONT_TEETH])
        if (planned.has(tooth)) continue
        planned.add(tooth)
        const condition = weighted([
          ["filling", 5],
          ["crown", 2],
          ["root_canal", 2],
          ["missing", 2],
        ] as const)
        await db.toothFinding.create({
          data: {
            patientId: state.id,
            tooth,
            surfaces: condition === "filling" ? pick([["O"], ["M", "O"], ["O", "D"]]) : [],
            condition,
            notes: "عمل سابق في عيادة أخرى",
            recordedById: dentist.id,
            createdAt,
          },
        })
      }
    }

    // Files: a panoramic X-ray for most new patients, sometimes more.
    if (chance(0.55)) await attach(state.id, dentist, day, "xray", "panoramic.png", panoramicXray())
    if (chance(0.25))
      await attach(state.id, dentist, day, "xray", "periapical.png", periapicalXray())
    if (chance(0.12))
      await attach(state.id, dentist, day, "photo", "intraoral.png", intraoralPhoto())
    if (chance(0.06)) {
      await attach(
        state.id,
        dentist,
        day,
        "document",
        "referral.pdf",
        referralPdf("Referral letter"),
      )
    }

    // A second, optional plan: still proposed, or declined by the patient.
    const extra = chance(0.12) ? "proposed" : chance(0.05) ? "cancelled" : null
    if (!extra) return
    const plan = await db.treatmentPlan.create({
      data: {
        patientId: state.id,
        title: extra === "proposed" ? "تجميل الأسنان الأمامية" : "تاج بديل (رفضه المريض)",
        status: extra,
        notes: extra === "proposed" ? "يفكر المريض ويعود للقرار" : "فضّل المريض تأجيل العلاج",
        createdById: dentist.id,
        createdAt,
      },
    })
    const items =
      extra === "proposed"
        ? [
            { procedure: "تبييض", tooth: null },
            { procedure: "فينير", tooth: pick(FRONT_TEETH) },
          ]
        : [{ procedure: "تاج زيركون", tooth: pick(MOLARS) }]
    for (const item of items) {
      const procedure = procedures.get(item.procedure)!
      await db.treatmentPlanItem.create({
        data: {
          planId: plan.id,
          procedureId: procedure.id,
          tooth: item.tooth,
          surfaces: [],
          price: procedure.price,
          currency: "IQD",
          status: extra === "cancelled" ? "cancelled" : "planned",
          createdAt,
        },
      })
    }
  }

  async function attach(
    patientId: string,
    dentist: CurrentUser,
    day: string,
    kind: "xray" | "photo" | "document",
    originalName: string,
    bytes: Buffer,
  ) {
    const type = detectFileType(bytes)!
    const { storedName, sha256 } = await saveUpload(bytes, type)
    await db.attachment.create({
      data: {
        patientId,
        kind,
        originalName,
        storedName,
        mimeType: type.mime,
        sizeBytes: bytes.length,
        sha256,
        takenAt: new Date(`${day}T00:00:00Z`),
        uploadedById: dentist.id,
        createdAt: zonedInstant(day, DAY_START + 10, TZ),
      },
    })
    counts.files++
  }

  /** Does the next one or two planned treatments (in phase order). */
  async function treat(state: PatientState, dentist: CurrentUser, at: Date) {
    const items = await db.treatmentPlanItem.findMany({
      where: { planId: state.planId! },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
      select: { id: true, status: true, phase: true },
    })
    const firstVisit = items.every((i) => i.status === "planned")
    if (state.template === "ortho") {
      // Orthodontics runs for months: in progress, adjusted monthly.
      await db.treatmentPlanItem.updateMany({
        where: { planId: state.planId!, status: "planned" },
        data: { status: "in_progress", dentistId: dentist.id },
      })
      return { items: 0, firstVisit }
    }
    const open = items.filter((i) => i.status === "planned")
    const phase = open[0]?.phase
    const batch = open
      .filter((i) => i.phase === phase)
      .slice(0, state.template === "hygiene" ? 3 : int(1, 2))
    for (const item of batch) {
      await db.treatmentPlanItem.update({
        where: { id: item.id },
        data: { status: "done", completedAt: at, dentistId: dentist.id },
      })
    }
    const after = await db.treatmentPlanItem.findMany({
      where: { planId: state.planId! },
      select: { status: true },
    })
    if (shouldCompletePlan(after)) {
      await db.treatmentPlan.update({ where: { id: state.planId! }, data: { status: "completed" } })
    }
    return { items: batch.length, firstVisit }
  }

  async function billVisit(
    state: PatientState,
    day: string,
    queue: Map<string, ScheduledPayment[]>,
  ) {
    const items = await db.treatmentPlanItem.findMany({
      where: { plan: { patientId: state.id }, status: "done", invoiceId: null },
      select: { id: true, price: true },
    })
    if (items.length === 0) return
    // Now and then reception gives a small discount (granted in Settings → Permissions).
    const discount = chance(0.12)
    const input = createInvoiceSchema.parse({
      patientId: state.id,
      kind: "visit",
      planId: "",
      lines: items.map((item, i) => ({
        planItemId: item.id,
        quantity: "1",
        discount:
          discount && i === 0 ? dinars(roundThousands(toMinor(item.price.toString()) / 10n)) : "",
      })),
      extraDiscount: "",
      dueDate: addDays(day, 30),
      notes: "",
    })
    let invoice = await createInvoice(reception, input, clockAt(day))
    counts.invoices++
    invoiceSerial++

    // Twice in the history the wrong treatment was billed: voided and issued again.
    if (invoiceSerial === 15 || invoiceSerial === 60) {
      await voidInvoice(
        owner,
        voidInvoiceSchema.parse({ id: invoice.id, reason: "خطأ في اختيار العلاج" }),
        clockAt(day, 21 * 60 + 5),
      )
      counts.voidedInvoices++
      invoice = await createInvoice(reception, input, clockAt(day, 21 * 60 + 10))
    }

    await payAfterVisit(state, day, queue)
  }

  async function billPlanUpFront(
    state: PatientState,
    day: string,
    queue: Map<string, ScheduledPayment[]>,
  ) {
    const items = await db.treatmentPlanItem.findMany({
      where: { planId: state.planId!, invoiceId: null, status: { not: "cancelled" } },
      select: { id: true },
    })
    await createInvoice(
      reception,
      createInvoiceSchema.parse({
        patientId: state.id,
        kind: "plan",
        planId: state.planId!,
        lines: items.map((item) => ({ planItemId: item.id, quantity: "1", discount: "" })),
        extraDiscount: "",
        dueDate: addDays(day, 90),
        notes: "تُسدَّد على دفعات شهرية",
      }),
      clockAt(day),
    )
    counts.invoices++
    // A first installment now, the rest monthly.
    const balance = await balanceOf(state.id)
    await pay(state.id, roundThousands((balance * 3n) / 10n), day)
    for (let month = 1; month <= 4; month++) {
      queuePayment(queue, nextOpen(addDays(day, month * 30 + int(-3, 5))), {
        patientId: state.id,
        amount: roundThousands(balance / 5n),
      })
    }
  }

  async function payAfterVisit(
    state: PatientState,
    day: string,
    queue: Map<string, ScheduledPayment[]>,
  ) {
    const balance = await balanceOf(state.id)
    if (balance <= 0n) return
    switch (state.payer) {
      case "prompt": {
        // Twice, a patient pays more and part of it is given back a few days later.
        if (refundsLeft > 0 && chance(0.08)) {
          await pay(state.id, balance + 2_000_000n, day) // 20,000 extra
          await refund(state.id, nextOpen(addDays(day, int(2, 6))), queue)
          refundsLeft--
        } else {
          await pay(state.id, balance, day)
        }
        break
      }
      case "partial":
        await pay(state.id, roundThousands(balance / 2n), day)
        queuePayment(queue, nextOpen(addDays(day, int(10, 40))), {
          patientId: state.id,
          amount: "balance",
        })
        break
      case "late":
        queuePayment(queue, nextOpen(addDays(day, int(35, 80))), {
          patientId: state.id,
          amount: "balance",
        })
        break
      case "never":
        break
    }
  }

  async function refund(patientId: string, day: string, queue: Map<string, ScheduledPayment[]>) {
    // Recorded on its own day, through the same queue as other money movements.
    const list = queue.get(day) ?? []
    list.push({ patientId, amount: -1_000_000n }) // negative = refund 10,000
    queue.set(day, list)
  }

  async function collect(due: ScheduledPayment, day: string) {
    if (due.amount !== "balance" && due.amount < 0n) {
      if (day > today) return
      await refundPatient(
        owner,
        refundSchema.parse({
          patientId: due.patientId,
          amount: dinars(-due.amount),
          method: "cash",
          reason: "مبلغ زائد دُفع بالخطأ",
        }),
        clockAt(day, DAY_START + 10),
      )
      counts.refunds++
      return
    }
    const balance = await balanceOf(due.patientId)
    const amount =
      due.amount === "balance"
        ? balance
        : due.amount > balance && balance > 0n
          ? balance
          : due.amount
    // Deposits arrive before there's anything to pay; installments stop once paid off.
    if (amount <= 0n || (due.amount !== "balance" && balance <= 0n && !isDeposit(due))) return
    await pay(due.patientId, amount, day, DAY_START + 5, due.method)
  }

  function isDeposit(due: ScheduledPayment) {
    return stateById.get(due.patientId)?.planId === null
  }

  async function pay(
    patientId: string,
    amount: bigint,
    day: string,
    minutes = 21 * 60 + 30,
    method: Method = weighted<Method>([
      ["cash", 60],
      ["card", 20],
      ["wallet", 20],
    ]),
  ) {
    if (amount <= 0n) return
    paymentSerial++
    const reference =
      method === "wallet"
        ? `${pick(["FIB", "ZC", "QI"])}-${int(100000, 999999)}`
        : method === "card"
          ? `POS-${int(10000, 99999)}`
          : ""
    const input = (value: bigint) =>
      recordPaymentSchema.parse({
        patientId,
        amount: dinars(value),
        method,
        reference,
        invoiceId: "",
        notes: "",
        idempotencyKey: crypto.randomUUID(),
      })

    // Once in the history, an extra zero was typed: voided and entered again.
    if (paymentSerial === 30) {
      const wrong = await recordPayment(reception, input(amount * 10n), clockAt(day, minutes))
      await voidPayment(
        owner,
        voidPaymentSchema.parse({ id: wrong.id, reason: "مبلغ خاطئ (صفر زائد)" }),
        clockAt(day, minutes + 2),
      )
      counts.voidedPayments++
    }
    await recordPayment(reception, input(amount), clockAt(day, minutes + 3))
    counts.payments++
  }

  /** The daily cash close; now and then the count is a little off, with a note. */
  async function closeDrawer(day: string) {
    const expected = toMinor(summarize(await unclosedMovements(db)).expected)
    // Random small differences, plus one shortage and one overage in the last two weeks
    // so the "last 30 days" panel has something to show.
    const off =
      day === recentShort
        ? -200_000n
        : day === recentOver
          ? 500_000n
          : chance(0.08)
            ? BigInt(pick([-1, 1]) * int(1, 10)) * 100_000n
            : 0n
    const counted = expected + off < 0n ? 0n : expected + off
    const notes =
      counted === expected
        ? ""
        : expected < 0n
          ? "صُرف الاسترجاع من الفكة"
          : off < 0n
            ? pick(["فكة أُعطيت لمريض ولم تُسجَّل", "خطأ في العد", "مبلغ ناقص، يُراجع غداً"])
            : pick(["مريض دفع ولم تُسجَّل دفعته", "زيادة غير معروفة السبب"])
    await closeCashDrawer(
      reception,
      closeCashSchema.parse({ counted: dinars(counted), notes }),
      clockAt(day, 22 * 60 + 5),
    )
    counts.closes++
  }

  async function nextPlanned(planId: string) {
    const item = await db.treatmentPlanItem.findFirst({
      where: { planId, status: { in: ["planned", "in_progress"] } },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
      select: { procedureId: true },
    })
    return item?.procedureId ?? procedures.get("كشف واستشارة")!.id
  }

  function isOpen(day: string) {
    return weekdayOf(day) !== 5 && !holidays.has(day)
  }
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

const PLAN_TITLES: Record<Template, string> = {
  fillings: "حشوات",
  rootCanal: "علاج عصب وتاج",
  extraction: "قلع",
  hygiene: "كشف وتنظيف",
  whitening: "تبييض",
  implant: "زراعة وتاج",
  ortho: "تقويم ثابت",
}

function planSpecs(template: Template): ItemSpec[] {
  switch (template) {
    case "fillings": {
      const teeth = new Set<number>()
      while (teeth.size < int(1, 3)) teeth.add(pick(BACK_TEETH))
      return [...teeth].map((tooth) => {
        const surfaces = chance(0.5)
          ? ["O"]
          : pick([
              ["M", "O"],
              ["O", "D"],
              ["M", "O", "D"],
            ])
        return {
          procedure: chance(0.8) ? "حشوة تجميلية (كومبوزيت)" : "حشوة أملغم",
          tooth,
          surfaces,
          phase: 1,
          finding: { condition: "caries", surfaces },
        }
      })
    }
    case "rootCanal": {
      const tooth = pick(MOLARS)
      return [
        {
          procedure: "علاج عصب - رحى",
          tooth,
          surfaces: [],
          phase: 1,
          finding: { condition: "caries", surfaces: ["O"] },
        },
        {
          procedure: chance(0.7) ? "تاج زيركون" : "تاج بورسلين على معدن",
          tooth,
          surfaces: [],
          phase: 2,
        },
      ]
    }
    case "extraction":
      return [
        {
          procedure: chance(0.7) ? "قلع بسيط" : "قلع جراحي",
          tooth: pick([...BACK_TEETH, 18, 28, 38, 48]),
          surfaces: [],
          phase: 1,
          finding: { condition: "root_remnant", surfaces: [] },
        },
      ]
    case "hygiene":
      return [
        { procedure: "كشف واستشارة", tooth: null, surfaces: [], phase: 1 },
        { procedure: "تنظيف وتلميع", tooth: null, surfaces: [], phase: 1 },
        ...(chance(0.5)
          ? [{ procedure: "أشعة بانوراما", tooth: null, surfaces: [], phase: 1 }]
          : []),
      ]
    case "whitening":
      return [
        { procedure: "تنظيف وتلميع", tooth: null, surfaces: [], phase: 1 },
        { procedure: "تبييض", tooth: null, surfaces: [], phase: 2 },
      ]
    case "implant": {
      const tooth = pick(MOLARS)
      return [
        {
          procedure: "زرعة سنية",
          tooth,
          surfaces: [],
          phase: 1,
          finding: { condition: "missing", surfaces: [] },
        },
        { procedure: "تاج زيركون", tooth, surfaces: [], phase: 2 },
      ]
    }
    case "ortho":
      return [
        { procedure: "أشعة بانوراما", tooth: null, surfaces: [], phase: 1 },
        { procedure: "تقويم ثابت (كامل)", tooth: null, surfaces: [], phase: 1 },
        ...(chance(0.4)
          ? [{ procedure: "فينير", tooth: pick(FRONT_TEETH), surfaces: [], phase: 2 }]
          : []),
      ]
  }
}

/** A random day from `from` to `from + span` that isn't a Friday (no pile-up on Saturdays). */
function openDayBetween(from: string, span: number): string {
  for (;;) {
    const day = addDays(from, int(0, span))
    if (weekdayOf(day) !== 5) return day
  }
}

function nextOpen(day: string): string {
  let d = day
  while (weekdayOf(d) === 5) d = addDays(d, 1)
  return d
}

function schedule(agenda: Map<string, Visit[]>, day: string, visit: Visit) {
  if (day > last) return
  const list = agenda.get(day) ?? []
  list.push(visit)
  agenda.set(day, list)
}

function queuePayment(
  queue: Map<string, ScheduledPayment[]>,
  day: string,
  payment: ScheduledPayment,
) {
  if (day > today) return
  const list = queue.get(day) ?? []
  list.push(payment)
  queue.set(day, list)
}

/** What the patient owes now (negative = credit): invoices − payments + refunds. */
async function balanceOf(patientId: string): Promise<bigint> {
  const [invoiced, paid, refunded] = await Promise.all([
    db.invoice.aggregate({ where: { patientId, status: "issued" }, _sum: { total: true } }),
    db.payment.aggregate({ where: { patientId, voidedAt: null }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { patientId }, _sum: { amount: true } }),
  ])
  const minor = (v: { toString(): string } | null) => (v ? toMinor(v.toString()) : 0n)
  return minor(invoiced._sum.total) - minor(paid._sum.amount) + minor(refunded._sum.amount)
}

async function createPatient(registeredOn: string) {
  const gender = rand() < 0.55 ? "female" : "male"
  const fullName = `${pick(gender === "female" ? FEMALE : MALE)} ${pick(MALE)} ${pick(MALE)} ${pick(FAMILY)}`
  const age = int(6, 78)
  const columns = {
    fullName,
    gender,
    birthDate: new Date(Date.UTC(2026 - age, int(0, 11), int(1, 28))),
    birthDateEstimated: rand() < 0.4,
    phone: `+9647${pick(["5", "7", "8", "9"])}${int(0, 9)}${String(int(0, 9_999_999)).padStart(7, "0")}`,
    phone2: null,
    address: rand() < 0.7 ? pick(AREAS) : null,
    referralSource: pick(REFERRALS),
  } as const
  const createdAt = zonedInstant(registeredOn, DAY_START - 15, TZ)
  const patient = await db.patient.create({
    data: { ...columns, searchText: buildSearchText(columns), createdAt },
    select: { id: true, code: true },
  })
  await db.patient.update({
    where: { id: patient.id },
    data: { searchText: buildSearchText({ ...columns, code: patient.code }) },
  })
  await recordIntake(patient.id, { gender, age }, createdAt)
  return patient.id
}

/**
 * The intake questionnaire: most patients declare nothing; some have conditions,
 * allergies, regular medicines, or (women 20–40) a pregnancy.
 */
async function recordIntake(
  patientId: string,
  patient: { gender: string; age: number },
  createdAt: Date,
) {
  const conditions = rand() < 0.25 ? [pick(CONDITIONS)] : []
  const allergies = rand() < 0.08 ? [pick(ALLERGIES)] : []
  const pregnant =
    patient.gender === "female" && patient.age >= 20 && patient.age <= 40 && rand() < 0.06
  await db.medicalHistory.create({
    data: {
      patientId,
      version: 1,
      noneDeclared: conditions.length === 0 && allergies.length === 0 && !pregnant,
      conditions,
      allergies,
      medications: conditions.includes("anticoagulants")
        ? "Aspirin 100 mg يومياً"
        : conditions.includes("diabetes")
          ? "Metformin 500 mg مرتين يومياً"
          : conditions.includes("hypertension")
            ? "Amlodipine 5 mg يومياً"
            : null,
      pregnant,
      smoker: rand() < 0.2,
      createdAt,
    },
  })
}

/** Existing patients without an intake get one (an existing clinic's records). */
async function ensureMedicalHistory(
  patient: { id: string; gender: string; birthDate: Date | null },
  registeredOn: string,
) {
  const has = await db.medicalHistory.findFirst({
    where: { patientId: patient.id },
    select: { id: true },
  })
  if (has) return
  const age = patient.birthDate ? 2026 - patient.birthDate.getUTCFullYear() : int(10, 70)
  await recordIntake(
    patient.id,
    { gender: patient.gender, age },
    zonedInstant(registeredOn, DAY_START - 15, TZ),
  )
}

/** A later version of the history: the patient started a medicine or reported a condition. */
async function updateMedicalHistory(patientId: string, day: string) {
  if (day > today) return
  const latest = await db.medicalHistory.findFirst({
    where: { patientId },
    orderBy: { version: "desc" },
  })
  if (!latest) return
  const added = pick(["anticoagulants", "hypertension", "diabetes"] as const)
  await db.medicalHistory.create({
    data: {
      patientId,
      version: latest.version + 1,
      noneDeclared: false,
      conditions: [...new Set([...latest.conditions, added])],
      otherConditions: latest.otherConditions,
      allergies: latest.allergies,
      otherAllergies: latest.otherAllergies,
      medications:
        added === "anticoagulants"
          ? "Aspirin 100 mg يومياً (بدأ حديثاً)"
          : added === "diabetes"
            ? "Metformin 500 mg مرتين يومياً"
            : "Amlodipine 5 mg يومياً",
      pregnant: false,
      smoker: latest.smoker,
      notes: "تحديث عند زيارة المتابعة",
      createdAt: zonedInstant(day, DAY_START, TZ),
    },
  })
}

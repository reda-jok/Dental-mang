// Demo data for development: realistic Iraqi patients to test search and paging.
//   pnpm --filter clinic db:seed-demo            (1000 patients)
//   pnpm --filter clinic db:seed-demo -- 5000
// Deterministic (same data every run). Refuses to run against production.

import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { buildSearchText } from "../src/features/patients/search"

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.")
  process.exit(1)
}

const count = Number(process.argv[2] ?? 1000)
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// Small deterministic PRNG (mulberry32).
let seed = 20260929
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

const MALE = [
  "محمد",
  "أحمد",
  "علي",
  "حسين",
  "حسن",
  "مصطفى",
  "عباس",
  "مرتضى",
  "كرار",
  "حيدر",
  "عمر",
  "يوسف",
  "إبراهيم",
  "سجاد",
  "زيد",
  "محمود",
  "عبدالله",
  "مهدي",
  "جعفر",
  "قاسم",
  "سلام",
  "رعد",
  "فراس",
  "ياسر",
  "أمير",
]
const FEMALE = [
  "فاطمة",
  "زينب",
  "مريم",
  "نور",
  "سارة",
  "رقية",
  "زهراء",
  "آية",
  "هدى",
  "إسراء",
  "رنا",
  "شهد",
  "دعاء",
  "ضحى",
  "بنين",
  "حوراء",
  "نبأ",
  "أسماء",
  "سجى",
  "ملاك",
  "آمنة",
  "رسل",
  "غدير",
  "تبارك",
  "هبة",
]
const FAMILY = [
  "الجبوري",
  "التميمي",
  "الدليمي",
  "العبيدي",
  "الساعدي",
  "الموسوي",
  "الحسيني",
  "الربيعي",
  "الخفاجي",
  "الزبيدي",
  "الشمري",
  "العزاوي",
  "الكعبي",
  "الأسدي",
  "البياتي",
  "السامرائي",
  "الكبيسي",
  "الجنابي",
  "المالكي",
  "العامري",
]
const AREAS = [
  "بغداد - الكرادة",
  "بغداد - المنصور",
  "بغداد - الأعظمية",
  "بغداد - زيونة",
  "بغداد - الدورة",
  "بغداد - الشعب",
  "بغداد - اليرموك",
  "بغداد - الحرية",
]
const DEMO_CONDITIONS = [
  "diabetes",
  "hypertension",
  "anticoagulants",
  "asthma",
  "heart_disease",
  "thyroid",
]
const DEMO_ALLERGIES = ["penicillin", "nsaids", "local_anesthetic"]
const REFERRALS = ["صديق", "فيسبوك", "إنستغرام", "طبيب آخر", "مريض سابق", null, null]

function phone() {
  return `+9647${pick(["5", "7", "8", "9"])}${int(0, 9)}${String(int(0, 9_999_999)).padStart(7, "0")}`
}

async function main() {
  const existing = await db.patient.count()
  console.log(`Adding ${count} demo patients (existing: ${existing})…`)

  for (let i = 0; i < count; i++) {
    const gender = rand() < 0.55 ? "female" : "male"
    const fullName = `${pick(gender === "female" ? FEMALE : MALE)} ${pick(MALE)} ${pick(MALE)} ${pick(FAMILY)}`
    const age = int(3, 80)
    const birth = new Date(Date.UTC(2026 - age, int(0, 11), int(1, 28)))
    const columns = {
      fullName,
      gender,
      birthDate: birth,
      birthDateEstimated: rand() < 0.4,
      phone: rand() < 0.9 ? phone() : null,
      phone2: rand() < 0.15 ? phone() : null,
      address: rand() < 0.7 ? pick(AREAS) : null,
      referralSource: pick(REFERRALS),
    } as const

    const created = await db.patient.create({
      data: { ...columns, searchText: buildSearchText(columns) },
      select: { id: true, code: true },
    })
    await db.patient.update({
      where: { id: created.id },
      data: { searchText: buildSearchText({ ...columns, code: created.code }) },
    })
    // Intake questionnaire: most patients declare nothing; some have findings.
    const conditions = rand() < 0.25 ? [pick(DEMO_CONDITIONS)] : []
    const allergies = rand() < 0.08 ? [pick(DEMO_ALLERGIES)] : []
    await db.medicalHistory.create({
      data: {
        patientId: created.id,
        version: 1,
        noneDeclared: conditions.length === 0 && allergies.length === 0,
        conditions,
        allergies,
        pregnant: false,
        smoker: rand() < 0.2,
      },
    })
    if ((i + 1) % 250 === 0) console.log(`  ${i + 1}`)
  }
  console.log("Done.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())

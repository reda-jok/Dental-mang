// Names, staff and prices for the demo clinic (Baghdad, prices in IQD).

export const PASSWORD = "demo-pass-2026"

export const CLINIC = {
  name: "عيادة الابتسامة لطب الأسنان",
  phone: "+9647701234567",
  address: "بغداد - الكرادة، شارع 62",
  receiptFooter: "الدوام من السبت إلى الخميس، 3:30 م - 10:00 م. شكراً لزيارتكم.",
}

export const STAFF = [
  { username: "owner", name: "د. علي الحسيني", role: "owner" },
  { username: "admin", name: "حسن الكعبي", role: "admin" },
  { username: "sara", name: "د. سارة الموسوي", role: "dentist" },
  { username: "haider", name: "د. حيدر الربيعي", role: "dentist" },
  { username: "zahraa", name: "زهراء العامري", role: "assistant" },
  { username: "reem", name: "ريم الجبوري", role: "reception" },
  { username: "mahmoud", name: "محمود السامرائي", role: "accountant" },
] as const

export const ROOMS = ["الكرسي 1", "الكرسي 2"]

/** Price per procedure in the starter catalog (procedures/starter.ts). */
export const PRICES: Record<string, number> = {
  "كشف واستشارة": 10_000,
  "أشعة صغيرة (حول الذروة)": 5_000,
  "أشعة بانوراما": 20_000,
  "تنظيف وتلميع": 25_000,
  فلورايد: 15_000,
  "سد الشقوق (سيلانت)": 15_000,
  "حشوة تجميلية (كومبوزيت)": 35_000,
  "حشوة أملغم": 25_000,
  "حشوة مؤقتة": 10_000,
  "علاج عصب - سن أمامي": 100_000,
  "علاج عصب - ضاحك": 125_000,
  "علاج عصب - رحى": 175_000,
  "إعادة علاج عصب": 200_000,
  "قلع بسيط": 20_000,
  "قلع جراحي": 50_000,
  "قلع ضرس عقل منطمر": 100_000,
  "تاج زيركون": 200_000,
  "تاج بورسلين على معدن": 125_000,
  "جسر (لكل سن)": 150_000,
  فينير: 175_000,
  "طقم كامل": 400_000,
  "زرعة سنية": 900_000,
  "تقويم ثابت (كامل)": 1_500_000,
  تبييض: 150_000,
}

export const MALE = [
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
export const FEMALE = [
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
export const FAMILY = [
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
export const AREAS = [
  "بغداد - الكرادة",
  "بغداد - المنصور",
  "بغداد - الأعظمية",
  "بغداد - زيونة",
  "بغداد - الدورة",
  "بغداد - الشعب",
  "بغداد - اليرموك",
  "بغداد - الحرية",
]
export const CONDITIONS = [
  "diabetes",
  "hypertension",
  "anticoagulants",
  "asthma",
  "heart_disease",
  "thyroid",
]
export const ALLERGIES = ["penicillin", "nsaids", "local_anesthetic"]
export const REFERRALS = ["صديق", "فيسبوك", "إنستغرام", "طبيب آخر", "مريض سابق", null, null]

/** Back teeth (premolars + molars) where fillings and root canals usually go. */
export const BACK_TEETH = [14, 15, 16, 17, 24, 25, 26, 27, 34, 35, 36, 37, 44, 45, 46, 47]
export const MOLARS = [16, 17, 26, 27, 36, 37, 46, 47]
export const FRONT_TEETH = [11, 12, 13, 21, 22, 23]

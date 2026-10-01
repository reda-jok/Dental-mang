// A starter catalog of common procedures (prices left at 0 for the clinic to fill in).
import type { ToothCondition } from "../chart/teeth"

type Starter = {
  category: string
  procedures: {
    name: string
    toothScope: "none" | "tooth" | "surfaces"
    chartResult?: ToothCondition
    durationMinutes?: number
    requiresLab?: boolean
  }[]
}

export const STARTER_CATALOG: Starter[] = [
  {
    category: "تشخيص ووقاية",
    procedures: [
      { name: "كشف واستشارة", toothScope: "none", durationMinutes: 15 },
      { name: "أشعة صغيرة (حول الذروة)", toothScope: "tooth", durationMinutes: 10 },
      { name: "أشعة بانوراما", toothScope: "none", durationMinutes: 10 },
      { name: "تنظيف وتلميع", toothScope: "none", durationMinutes: 30 },
      { name: "فلورايد", toothScope: "none", durationMinutes: 15 },
      { name: "سد الشقوق (سيلانت)", toothScope: "tooth", durationMinutes: 15 },
    ],
  },
  {
    category: "حشوات",
    procedures: [
      {
        name: "حشوة تجميلية (كومبوزيت)",
        toothScope: "surfaces",
        chartResult: "filling",
        durationMinutes: 30,
      },
      { name: "حشوة أملغم", toothScope: "surfaces", chartResult: "filling", durationMinutes: 30 },
      { name: "حشوة مؤقتة", toothScope: "surfaces", chartResult: "filling", durationMinutes: 15 },
    ],
  },
  {
    category: "علاج العصب",
    procedures: [
      {
        name: "علاج عصب - سن أمامي",
        toothScope: "tooth",
        chartResult: "root_canal",
        durationMinutes: 60,
      },
      {
        name: "علاج عصب - ضاحك",
        toothScope: "tooth",
        chartResult: "root_canal",
        durationMinutes: 60,
      },
      {
        name: "علاج عصب - رحى",
        toothScope: "tooth",
        chartResult: "root_canal",
        durationMinutes: 90,
      },
      {
        name: "إعادة علاج عصب",
        toothScope: "tooth",
        chartResult: "root_canal",
        durationMinutes: 90,
      },
    ],
  },
  {
    category: "قلع وجراحة",
    procedures: [
      { name: "قلع بسيط", toothScope: "tooth", chartResult: "missing", durationMinutes: 20 },
      { name: "قلع جراحي", toothScope: "tooth", chartResult: "missing", durationMinutes: 45 },
      {
        name: "قلع ضرس عقل منطمر",
        toothScope: "tooth",
        chartResult: "missing",
        durationMinutes: 60,
      },
    ],
  },
  {
    category: "تركيبات",
    procedures: [
      {
        name: "تاج زيركون",
        toothScope: "tooth",
        chartResult: "crown",
        durationMinutes: 45,
        requiresLab: true,
      },
      {
        name: "تاج بورسلين على معدن",
        toothScope: "tooth",
        chartResult: "crown",
        durationMinutes: 45,
        requiresLab: true,
      },
      {
        name: "جسر (لكل سن)",
        toothScope: "tooth",
        chartResult: "bridge",
        durationMinutes: 45,
        requiresLab: true,
      },
      {
        name: "فينير",
        toothScope: "tooth",
        chartResult: "veneer",
        durationMinutes: 45,
        requiresLab: true,
      },
      { name: "طقم كامل", toothScope: "none", durationMinutes: 45, requiresLab: true },
    ],
  },
  {
    category: "زراعة",
    procedures: [
      {
        name: "زرعة سنية",
        toothScope: "tooth",
        chartResult: "implant",
        durationMinutes: 90,
        requiresLab: true,
      },
    ],
  },
  {
    category: "تقويم وتجميل",
    procedures: [
      { name: "تقويم ثابت (كامل)", toothScope: "none", durationMinutes: 60 },
      { name: "تبييض", toothScope: "none", durationMinutes: 60 },
    ],
  },
]

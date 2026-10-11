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

/** What each starter procedure is, in plain words for the patient (printed on the plan). */
export const STARTER_NOTES: Record<string, string> = {
  "كشف واستشارة": "فحص الفم والأسنان ومناقشة حالتك وخيارات العلاج المناسبة لك.",
  "أشعة صغيرة (حول الذروة)": "صورة أشعة لسن واحد تُظهر الجذر والعظم حوله، لاكتشاف التسوس أو الالتهاب.",
  "أشعة بانوراما": "صورة واحدة لكل الأسنان والفكين، تساعد الطبيب على تخطيط العلاج.",
  "تنظيف وتلميع": "إزالة الجير والتصبغات عن الأسنان لحماية اللثة من الالتهاب والنزف.",
  فلورايد: "طبقة واقية تقوّي مينا الأسنان وتقلل التسوس، خاصة عند الأطفال.",
  "سد الشقوق (سيلانت)": "مادة رقيقة تُغلق شقوق سطح الضرس فتمنع بقاء الطعام وحدوث التسوس.",
  "حشوة تجميلية (كومبوزيت)": "إزالة التسوس وملء السن بمادة بلون السن الطبيعي.",
  "حشوة أملغم": "إزالة التسوس وملء الضرس بحشوة معدنية متينة تتحمل المضغ.",
  "حشوة مؤقتة": "حشوة تحمي السن لفترة قصيرة حتى الجلسة القادمة.",
  "علاج عصب - سن أمامي": "تنظيف العصب الملتهب من داخل السن وحشو قناته، لإنقاذ السن بدل قلعه.",
  "علاج عصب - ضاحك": "تنظيف العصب الملتهب من داخل السن وحشو قنواته، لإنقاذ السن بدل قلعه.",
  "علاج عصب - رحى": "تنظيف أعصاب الضرس الملتهبة وحشو قنواته لإنقاذه بدل قلعه، وقد يحتاج جلستين.",
  "إعادة علاج عصب": "إعادة تنظيف وحشو قنوات سن عولج سابقاً ثم عاد إليه الالتهاب.",
  "قلع بسيط": "إزالة سن لا يمكن إنقاذه، تحت التخدير الموضعي.",
  "قلع جراحي": "إزالة سن مكسور أو صعب عبر فتحة صغيرة في اللثة، مع غرز تُزال بعد أسبوع.",
  "قلع ضرس عقل منطمر": "إزالة ضرس العقل المدفون في العظم لأنه يسبب ألماً أو التهاباً أو يضغط على الأسنان.",
  "تاج زيركون": "غطاء قوي بلون السن الطبيعي يحمي السن الضعيف أو المعالج عصبياً ويعيد شكله.",
  "تاج بورسلين على معدن": "غطاء من معدن مكسو بالبورسلين يحمي السن الضعيف ويعيد شكله.",
  "جسر (لكل سن)": "تعويض سن مفقود بتيجان ترتكز على الأسنان المجاورة، ويُحسب السعر لكل سن فيه.",
  فينير: "قشرة رقيقة تُلصق على واجهة السن الأمامي لتحسين لونه وشكله.",
  "طقم كامل": "أسنان متحركة تعوّض كل الأسنان المفقودة في الفك.",
  "زرعة سنية": "جذر من التيتانيوم يُزرع في عظم الفك ليحمل سناً جديداً ثابتاً.",
  "تقويم ثابت (كامل)": "أسلاك وحاصرات تحرّك الأسنان تدريجياً إلى مكانها الصحيح خلال عدة أشهر.",
  تبييض: "تفتيح لون الأسنان بمادة آمنة تحت إشراف الطبيب.",
}

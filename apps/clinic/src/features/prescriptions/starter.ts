// A starter medicines list for a dental clinic (Iraq). Suggested instructions only:
// every clinic edits the list in Settings → Medicines, and the dentist can change the
// instructions on each prescription. `group` links a medicine to an allergy code
// (patients/medical.ts) so prescribing warns about the patient's allergies.

export type StarterMedication = {
  name: string
  form:
    | "tablet"
    | "capsule"
    | "syrup"
    | "suspension"
    | "mouthwash"
    | "gel"
    | "ointment"
    | "drops"
    | "injection"
    | "other"
  dose: string
  frequency: string
  duration: string
  group?: "penicillin" | "nsaids" | "chlorhexidine" | "local_anesthetic"
}

export const STARTER_MEDICATIONS: StarterMedication[] = [
  // Antibiotics
  {
    name: "Amoxicillin 500 mg",
    form: "capsule",
    dose: "كبسولة واحدة",
    frequency: "كل 8 ساعات",
    duration: "5 أيام",
    group: "penicillin",
  },
  {
    name: "Amoxicillin / Clavulanic acid 625 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 12 ساعة",
    duration: "5 أيام",
    group: "penicillin",
  },
  {
    name: "Amoxicillin / Clavulanic acid 1 g",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 12 ساعة",
    duration: "5 أيام",
    group: "penicillin",
  },
  {
    name: "Metronidazole 500 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 8 ساعات",
    duration: "5 أيام",
  },
  {
    name: "Clindamycin 300 mg",
    form: "capsule",
    dose: "كبسولة واحدة",
    frequency: "كل 8 ساعات",
    duration: "5 أيام",
  },
  {
    name: "Azithromycin 500 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "مرة يومياً",
    duration: "3 أيام",
  },
  // Pain and swelling
  {
    name: "Ibuprofen 400 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 8 ساعات بعد الأكل",
    duration: "3 أيام",
    group: "nsaids",
  },
  {
    name: "Ibuprofen 600 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 8 ساعات بعد الأكل",
    duration: "3 أيام",
    group: "nsaids",
  },
  {
    name: "Diclofenac potassium 50 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 12 ساعة بعد الأكل",
    duration: "3 أيام",
    group: "nsaids",
  },
  {
    name: "Mefenamic acid 500 mg",
    form: "tablet",
    dose: "حبة واحدة",
    frequency: "كل 8 ساعات بعد الأكل",
    duration: "3 أيام",
    group: "nsaids",
  },
  {
    name: "Paracetamol 500 mg",
    form: "tablet",
    dose: "حبتان",
    frequency: "كل 6 ساعات عند الحاجة",
    duration: "3 أيام",
  },
  // Mouth care
  {
    name: "Chlorhexidine 0.12% mouthwash",
    form: "mouthwash",
    dose: "مضمضة 15 مل لمدة 30 ثانية",
    frequency: "مرتين يومياً",
    duration: "7 أيام",
    group: "chlorhexidine",
  },
  {
    name: "Benzocaine 20% oral gel",
    form: "gel",
    dose: "طبقة رقيقة على المكان",
    frequency: "عند الحاجة",
    duration: "",
    group: "local_anesthetic",
  },
  {
    name: "Triamcinolone 0.1% oral paste",
    form: "ointment",
    dose: "طبقة رقيقة على القرحة",
    frequency: "3 مرات يومياً",
    duration: "5 أيام",
  },
  // Fungal infections
  {
    name: "Miconazole 2% oral gel",
    form: "gel",
    dose: "دهن داخل الفم",
    frequency: "4 مرات يومياً",
    duration: "7 أيام",
  },
  {
    name: "Nystatin 100,000 IU/ml suspension",
    form: "suspension",
    dose: "1 مل",
    frequency: "4 مرات يومياً",
    duration: "7 أيام",
  },
]

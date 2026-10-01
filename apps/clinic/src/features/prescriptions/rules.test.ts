import { describe, expect, it } from "vitest"

import { needsConfirmation, prescriptionWarnings } from "./rules"

const amoxicillin = { name: "Amoxicillin 500 mg", group: "penicillin" }
const ibuprofen = { name: "Ibuprofen 400 mg", group: "nsaids" }
const paracetamol = { name: "Paracetamol 500 mg", group: null }
const none = { allergies: [], conditions: [], pregnant: false }

describe("prescriptionWarnings", () => {
  it("is quiet when nothing on record applies", () => {
    expect(prescriptionWarnings(none, [amoxicillin, ibuprofen, paracetamol])).toEqual([])
    expect(prescriptionWarnings(none, [])).toEqual([])
  })

  it("flags a medicine the patient is allergic to, as danger", () => {
    const warnings = prescriptionWarnings({ ...none, allergies: ["penicillin"] }, [
      amoxicillin,
      paracetamol,
    ])
    expect(warnings).toEqual([
      { kind: "allergy", level: "danger", code: "penicillin", medication: "Amoxicillin 500 mg" },
    ])
    expect(needsConfirmation(warnings)).toEqual(["penicillin"])
  })

  it("cautions about NSAIDs with blood thinners, bleeding, kidney disease or asthma", () => {
    const warnings = prescriptionWarnings(
      { ...none, conditions: ["anticoagulants", "asthma", "diabetes"] },
      [ibuprofen, paracetamol],
    )
    expect(warnings).toEqual([
      {
        kind: "condition",
        level: "caution",
        code: "anticoagulants",
        medication: "Ibuprofen 400 mg",
      },
      { kind: "condition", level: "caution", code: "asthma", medication: "Ibuprofen 400 mg" },
    ])
    expect(needsConfirmation(warnings)).toEqual([])
  })

  it("reminds about pregnancy, and about a missing medical history", () => {
    expect(prescriptionWarnings({ ...none, pregnant: true }, [paracetamol])).toEqual([
      { kind: "pregnancy", level: "caution" },
    ])
    expect(prescriptionWarnings(null, [paracetamol])).toEqual([
      { kind: "noHistory", level: "caution" },
    ])
  })

  it("asks to confirm each allergy once", () => {
    const warnings = prescriptionWarnings({ ...none, allergies: ["penicillin", "nsaids"] }, [
      amoxicillin,
      { name: "Amoxicillin / Clavulanic acid 625 mg", group: "penicillin" },
      ibuprofen,
    ])
    expect(needsConfirmation(warnings)).toEqual(["penicillin", "nsaids"])
  })
})

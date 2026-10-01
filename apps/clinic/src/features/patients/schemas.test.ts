import { describe, expect, it } from "vitest"

import {
  createPatientSchema,
  medicalHistorySchema,
  patientSearchSchema,
  updatePatientSchema,
} from "./schemas"

const noneDeclared = {
  noneDeclared: true,
  conditions: [],
  allergies: [],
  pregnant: false,
  smoker: false,
}

const base = {
  fullName: "  أحمد  علي حسن ",
  gender: "male",
  phone: "0770 123 4567",
  birthMode: "age",
  age: "40",
  medical: noneDeclared,
}

const issue = (input: object) =>
  createPatientSchema.safeParse({ ...base, ...input }).error?.issues[0]?.message

describe("createPatientSchema", () => {
  it("cleans text and normalizes the phone", () => {
    const out = createPatientSchema.parse(base)
    expect(out.fullName).toBe("أحمد علي حسن")
    expect(out.phone).toBe("+9647701234567")
    expect(out.phone2).toBeNull()
    expect(out.confirmDuplicate).toBe(false)
  })

  it("requires a phone number", () => {
    expect(issue({ phone: "" })).toBe("required")
    expect(issue({ phone: "   " })).toBe("required")
    expect(issue({ phone: "123" })).toBe("phoneInvalid")
  })

  it("requires an age or a birth date", () => {
    expect(issue({ age: "" })).toBe("invalidAge")
    expect(issue({ birthMode: "date", birthDate: "" })).toBe("invalidDate")
    expect(issue({ birthMode: "unknown" })).toBe("required")
  })

  it("accepts an age typed in Arabic digits", () => {
    expect(createPatientSchema.parse({ ...base, age: "٤٢" })).toMatchObject({
      birthMode: "age",
      age: 42,
    })
  })

  it("rejects impossible ages and future or malformed dates", () => {
    expect(issue({ age: "150" })).toBe("invalidAge")
    expect(issue({ age: "-1" })).toBe("invalidAge")
    expect(issue({ birthMode: "date", birthDate: "2999-01-01" })).toBe("invalidDate")
    expect(issue({ birthMode: "date", birthDate: "2021-02-30" })).toBe("invalidDate")
  })

  it("strips fields that don't belong to the chosen birth mode", () => {
    const out = createPatientSchema.parse({ ...base, birthMode: "date", birthDate: "1990-05-01" })
    expect(out).not.toHaveProperty("age")
  })

  it("requires a gender and a real name", () => {
    expect(issue({ fullName: "  " })).toBe("required")
    expect(issue({ gender: undefined })).toBe("required")
  })
})

describe("medical history at registration", () => {
  it("requires an explicit answer: items ticked, or 'none' declared", () => {
    expect(issue({ medical: { ...noneDeclared, noneDeclared: false } })).toBe(
      "medicalAnswerRequired",
    )
  })

  it("accepts ticked items", () => {
    const out = createPatientSchema.parse({
      ...base,
      medical: { ...noneDeclared, noneDeclared: false, allergies: ["penicillin"] },
    })
    expect(out.medical.allergies).toEqual(["penicillin"])
  })

  it("rejects 'none' together with ticked items", () => {
    expect(issue({ medical: { ...noneDeclared, conditions: ["diabetes"] } })).toBe(
      "medicalContradiction",
    )
    expect(issue({ medical: { ...noneDeclared, medications: "Warfarin 5mg" } })).toBe(
      "medicalContradiction",
    )
  })

  it("lets 'none' coexist with smoker / pregnant (they're not diseases)", () => {
    expect(
      createPatientSchema.safeParse({ ...base, medical: { ...noneDeclared, smoker: true } })
        .success,
    ).toBe(true)
  })
})

describe("updatePatientSchema", () => {
  it("keeps phone and age required when editing", () => {
    const edit = { ...base, medical: undefined, id: "7d9f5a3e-8c1b-4c2e-9a4f-1b2c3d4e5f60" }
    expect(updatePatientSchema.safeParse(edit).success).toBe(true)
    expect(updatePatientSchema.safeParse({ ...edit, phone: "" }).success).toBe(false)
  })
})

describe("medicalHistorySchema", () => {
  const valid = {
    ...noneDeclared,
    patientId: "7d9f5a3e-8c1b-4c2e-9a4f-1b2c3d4e5f60",
    baseVersion: 0,
  }

  it("applies the same explicit-answer rule", () => {
    expect(medicalHistorySchema.safeParse(valid).success).toBe(true)
    expect(medicalHistorySchema.safeParse({ ...valid, noneDeclared: false }).success).toBe(false)
  })

  it("rejects condition codes that aren't in the checklist", () => {
    const result = medicalHistorySchema.safeParse({
      ...valid,
      noneDeclared: false,
      conditions: ["diabetes", "made_up"],
    })
    expect(result.success).toBe(false)
  })

  it("rejects unknown fields", () => {
    expect(medicalHistorySchema.safeParse({ ...valid, isAdmin: true }).success).toBe(false)
  })
})

describe("patientSearchSchema", () => {
  it("falls back to safe defaults for bad URL params", () => {
    expect(patientSearchSchema.parse({ q: "x".repeat(500), page: "abc" })).toEqual({
      q: "",
      page: 1,
    })
    expect(patientSearchSchema.parse({ q: "علي", page: "3" })).toEqual({ q: "علي", page: 3 })
  })
})

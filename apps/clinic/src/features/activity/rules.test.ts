import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe as group, expect, it } from "vitest"

import messages from "../../../messages/ar.json"
import { ACTIVITY_AREAS, describe, SENSITIVE_ACTIONS, STANDALONE_ACTIONS } from "./rules"

const PATIENT = "814b6db1-7484-43a8-8ecd-19bd72a9ede0"

group("describe", () => {
  it("shows a payment's number and amount", () => {
    expect(
      describe({
        entity: "payment",
        entityId: "x",
        before: undefined,
        after: { amount: "300000", method: "cash", number: "RC-2026-000642" },
      }),
    ).toEqual({ number: "RC-2026-000642", amount: "300000" })
  })

  it("takes a void's amount from before and its reason from after", () => {
    expect(
      describe({
        entity: "invoice",
        entityId: "x",
        before: { total: "55000", status: "issued" },
        after: { reason: "خطأ في اختيار العلاج", status: "void" },
      }),
    ).toEqual({ amount: "55000", reason: "خطأ في اختيار العلاج" })
  })

  it("shows what a cash close counted, and the difference only when there is one", () => {
    const close = (difference: string) =>
      describe({
        entity: "cash_close",
        entityId: "x",
        before: null,
        after: { counted: "250000", expected: "272000", difference },
      })
    expect(close("-22000")).toEqual({ amount: "250000", difference: "-22000" })
    expect(close("0")).toEqual({ amount: "250000" })
  })

  it("keeps the username typed in a failed sign-in", () => {
    expect(
      describe({ entity: "session", entityId: null, before: null, after: { username: "reem" } }),
    ).toEqual({ username: "reem" })
  })

  it("links the patient: the entry itself, or the patient in its snapshot", () => {
    const patient = describe({ entity: "patient", entityId: PATIENT, before: null, after: {} })
    expect(patient.patientId).toBe(PATIENT)
    const note = describe({
      entity: "clinical_note",
      entityId: "x",
      before: null,
      after: { patientId: PATIENT },
    })
    expect(note.patientId).toBe(PATIENT)
    // Never a query with something that isn't an id.
    const odd = describe({ entity: "x", entityId: null, before: null, after: { patientId: "1" } })
    expect(odd.patientId).toBeUndefined()
  })

  it("ignores snapshots that aren't objects or values that aren't text", () => {
    expect(describe({ entity: "x", entityId: null, before: "text", after: [1] })).toEqual({})
    expect(describe({ entity: "x", entityId: null, before: null, after: { amount: 5 } })).toEqual(
      {},
    )
  })
})

group("areas", () => {
  it("puts each entity in one area at most", () => {
    const all = Object.values(ACTIVITY_AREAS).flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

group("translations", () => {
  const t = messages.activity

  // A new kind of audit entry shows as a generic "item" until it's named here.
  it("names every entity the code audits, and puts it in an area", () => {
    const entities = new Set<string>()
    const src = join(import.meta.dirname, "../..")
    for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file.startsWith("generated")) {
        continue
      }
      for (const [, entity] of readFileSync(join(src, file), "utf8").matchAll(
        /\bentity: "([a-z_]+)"/g,
      )) {
        entities.add(entity!)
      }
    }
    const inAreas = new Set<string>(Object.values(ACTIVITY_AREAS).flat())
    for (const entity of entities) {
      expect(t.entities, entity).toHaveProperty(entity)
      expect(inAreas.has(entity), entity).toBe(true)
    }
  })

  it("names every action", () => {
    const audit = readFileSync(join(import.meta.dirname, "../../server/audit.ts"), "utf8")
    const actions = [...audit.matchAll(/\| "([a-z_]+)"/g)].map((m) => m[1]!)
    expect(actions.length).toBeGreaterThan(5)
    for (const action of actions) {
      const standalone = (STANDALONE_ACTIONS as readonly string[]).includes(action)
      expect(standalone ? t.standalone : t.actions, action).toHaveProperty(action)
    }
    for (const action of SENSITIVE_ACTIONS) expect(actions).toContain(action)
  })
})

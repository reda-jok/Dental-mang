import { describe, expect, it } from "vitest"

import {
  cleanText,
  normalizeIraqiPhone,
  optionalPhone,
  optionalText,
  password,
  text,
  toLatinDigits,
  username,
} from "./validation"

describe("cleanText", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanText("  علي   حسن  ")).toBe("علي حسن")
  })

  it("strips bidi overrides and zero-width characters that could spoof a name", () => {
    expect(cleanText("Ali\u202Enassah\u202C")).toBe("Alinassah")
    expect(cleanText("ع\u200Bلي")).toBe("علي")
    expect(cleanText("\uFEFFname")).toBe("name")
  })

  it("strips control characters", () => {
    expect(cleanText("a\u0000b\u0007c")).toBe("abc")
  })

  it("keeps line breaks in multiline mode but limits blank lines", () => {
    expect(cleanText(" line 1 \n\n\n\n line 2 ", { multiline: true })).toBe("line 1\n\nline 2")
  })
})

describe("toLatinDigits", () => {
  it("converts Arabic-Indic and Persian digits", () => {
    expect(toLatinDigits("٠٧٧٠١٢٣٤٥٦٧")).toBe("07701234567")
    expect(toLatinDigits("۰۷۸۰")).toBe("0780")
    expect(toLatinDigits("abc 123")).toBe("abc 123")
  })
})

describe("text", () => {
  const schema = text(2, 10)

  it("rejects whitespace-only input as required", () => {
    const r = schema.safeParse("   ")
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe("required")
  })

  it("checks length after cleaning", () => {
    expect(schema.safeParse(" a ").error?.issues[0]?.message).toBe("tooShort")
    expect(schema.safeParse("a".repeat(11)).error?.issues[0]?.message).toBe("tooLong")
    expect(schema.parse("  عيادة  ")).toBe("عيادة")
  })

  it("rejects non-strings", () => {
    expect(schema.safeParse(42).success).toBe(false)
    expect(schema.safeParse(undefined).success).toBe(false)
  })
})

describe("optionalText", () => {
  it("turns empty or blank into null", () => {
    const schema = optionalText(50)
    expect(schema.parse("")).toBeNull()
    expect(schema.parse("   ")).toBeNull()
    expect(schema.parse(undefined)).toBeNull()
    expect(schema.parse(" بغداد ")).toBe("بغداد")
  })
})

describe("Iraqi phone numbers", () => {
  it("normalizes every common way of writing a mobile number", () => {
    for (const input of [
      "07701234567",
      "0770 123 4567",
      "0770-123-4567",
      "7701234567",
      "+9647701234567",
      "009647701234567",
      "٠٧٧٠١٢٣٤٥٦٧",
    ]) {
      expect(normalizeIraqiPhone(input), input).toBe("+9647701234567")
    }
  })

  it("rejects garbage and too-short numbers", () => {
    expect(normalizeIraqiPhone("123")).toBeNull()
    expect(normalizeIraqiPhone("hello")).toBeNull()
    expect(normalizeIraqiPhone("0770123")).toBeNull()
  })

  it("optionalPhone: empty is null, invalid is an error", () => {
    expect(optionalPhone.parse("")).toBeNull()
    expect(optionalPhone.parse(undefined)).toBeNull()
    expect(optionalPhone.safeParse("123").error?.issues[0]?.message).toBe("phoneInvalid")
  })
})

describe("username", () => {
  it("lowercases and accepts letters, digits, _ and .", () => {
    expect(username.parse("  Dr.Ali_2 ")).toBe("dr.ali_2")
  })

  it("rejects spaces, Arabic letters and symbols", () => {
    for (const bad of ["dr ali", "علي", "ali@clinic", "ali;drop"]) {
      expect(username.safeParse(bad).error?.issues[0]?.message, bad).toBe("usernameFormat")
    }
  })
})

describe("password", () => {
  it("rejects common and too-simple passwords", () => {
    expect(password.safeParse("12345678").error?.issues[0]?.message).toBe("passwordTooCommon")
    expect(password.safeParse("aaaaaaaa").error?.issues[0]?.message).toBe("passwordTooSimple")
    expect(password.safeParse("short").error?.issues[0]?.message).toBe("tooShort")
  })

  it("accepts a reasonable password", () => {
    expect(password.safeParse("correct-horse-42").success).toBe(true)
  })
})

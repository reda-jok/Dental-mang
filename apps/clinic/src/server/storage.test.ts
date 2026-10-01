import { describe, expect, it } from "vitest"

import { detectFileType } from "./storage"

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)])
const ascii = (s: string) =>
  new Uint8Array([...new TextEncoder().encode(s), ...new Array(16).fill(0)])

describe("detectFileType", () => {
  it("recognizes allowed images and PDFs by content", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg")
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mime).toBe(
      "image/png",
    )
    expect(detectFileType(ascii("RIFF\x00\x00\x00\x00WEBPVP8 "))?.mime).toBe("image/webp")
    expect(detectFileType(ascii("%PDF-1.7"))?.mime).toBe("application/pdf")
  })

  it("rejects anything else, whatever it's named", () => {
    expect(detectFileType(ascii("<html><script>alert(1)</script>"))).toBeNull()
    expect(detectFileType(ascii("<svg onload=alert(1)>"))).toBeNull() // SVG can carry scripts
    expect(detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull() // Windows .exe
    expect(detectFileType(ascii("GIF89a"))).toBeNull()
    expect(detectFileType(new Uint8Array())).toBeNull()
  })
})

// Demo files for the patient "X-rays & files" tab: generated grayscale X-ray-like
// PNGs, a coloured intra-oral "photo" and a one-page PDF. Plain Node (zlib), no
// image libraries.

import { crc32, deflateSync } from "node:zlib"

import { int, rand } from "./random"

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "latin1"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, crc])
}

/** Encodes 8-bit grayscale (channels 1) or RGB (channels 3) pixels as a PNG. */
function png(
  width: number,
  height: number,
  channels: 1 | 3,
  pixel: (x: number, y: number) => number[],
) {
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * channels) // filter byte 0 = none
    for (let x = 0; x < width; x++) {
      const values = pixel(x, y)
      for (let c = 0; c < channels; c++) row[1 + x * channels + c] = values[c]!
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = channels === 1 ? 0 : 2 // grayscale / truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

/** A panoramic-style X-ray: two arches of bright teeth on a dark, grainy background. */
export function panoramicXray() {
  const width = 640
  const height = 300
  const teeth = 16
  const missing = new Set(Array.from({ length: int(0, 3) }, () => int(0, 31)))
  const filled = new Set(Array.from({ length: int(1, 4) }, () => int(0, 31)))
  return png(width, height, 1, (x, y) => {
    let v = 25 + rand() * 18 // film grain
    for (const [arch, baseY, dir] of [
      [0, 120, -1],
      [1, 185, 1],
    ] as const) {
      const t = (x - 40) / (width - 80)
      if (t < 0 || t > 1) continue
      const curve = baseY + 30 * Math.sin(Math.PI * t) - 15 // the smile line of a panoramic
      const index = Math.floor(t * teeth) + arch * teeth
      const local = (t * teeth) % 1
      if (missing.has(index)) continue
      const crown = Math.abs(y - curve) < 22 && local > 0.12 && local < 0.88
      const root = dir * (y - curve) > 0 && dir * (y - curve) < 70 && Math.abs(local - 0.5) < 0.18
      if (crown) v = 170 + 40 * (1 - Math.abs(local - 0.5) * 2) + rand() * 15
      else if (root) v = Math.max(v, 120 + rand() * 20)
      if (crown && filled.has(index) && Math.abs(y - curve) < 9 && Math.abs(local - 0.5) < 0.2)
        v = 250 // fillings show bright white
    }
    return [clamp(v)]
  })
}

/** A periapical X-ray of one tooth with its roots. */
export function periapicalXray() {
  const width = 240
  const height = 320
  const filled = rand() < 0.5
  return png(width, height, 1, (x, y) => {
    let v = 30 + rand() * 20
    const cx = width / 2
    const crown = y > 40 && y < 140 && Math.abs(x - cx) < 60 - Math.max(0, (y - 120) * 0.5)
    const rootL =
      y >= 120 && y < 280 && Math.abs(x - (cx - 25 + (y - 120) * 0.05)) < 14 - (y - 120) * 0.06
    const rootR =
      y >= 120 && y < 280 && Math.abs(x - (cx + 25 - (y - 120) * 0.05)) < 14 - (y - 120) * 0.06
    if (crown) v = 180 + rand() * 25
    if (rootL || rootR) v = 140 + rand() * 20
    if (filled && crown && y < 90 && Math.abs(x - cx) < 30) v = 250
    return [clamp(v)]
  })
}

/** An intra-oral "photo": pink gums, off-white teeth. */
export function intraoralPhoto() {
  const width = 480
  const height = 320
  return png(width, height, 3, (x, y) => {
    const gum = [200 + rand() * 20, 110 + rand() * 15, 120 + rand() * 15]
    const toothBand = Math.abs(y - height / 2) < 55
    const gap = x % 60 < 4
    if (toothBand && !gap)
      return [235 + rand() * 10, 228 + rand() * 10, 205 + rand() * 10].map(clamp)
    return gum.map(clamp)
  })
}

/** A one-page PDF (referral / lab note). Latin text: no font embedding needed. */
export function referralPdf(title: string) {
  const text = `BT /F1 18 Tf 72 760 Td (${title}) Tj 0 -28 Td /F1 12 Tf (Demo document - generated for testing.) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, "latin1")
}

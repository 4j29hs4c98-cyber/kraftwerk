// Erzeugt die PNG-Icons der App aus der Logo-Geometrie (favicon.svg) ohne externe Abhängigkeiten.
// Aufruf: node scripts/generate-icons.mjs  (Ergebnis landet in public/)
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const OUT_DIR = fileURLToPath(new URL('../public/', import.meta.url))
const BG = [0x0c, 0x0d, 0x0f]
const ACCENT = [0xff, 0x7a, 0x1a]
// Blitz aus favicon.svg im 32er-Raster: M18 4 8 18h7l-2 10 11-15h-7z
const BOLT = [[18, 4], [8, 18], [15, 18], [13, 28], [24, 13], [17, 13]]
const SAMPLES = 4

function insidePolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

/**
 * @param size Kantenlänge in Pixeln
 * @param opts.rounded abgerundete Ecken mit Transparenz (sonst volle Fläche, z. B. für iOS und maskable)
 * @param opts.boltScale Anteil der Fläche, den der Blitz einnimmt (maskable braucht Sicherheitszone)
 */
function render(size, { rounded, boltScale }) {
  const unit = (size * boltScale) / 32
  const offset = (size - 32 * unit) / 2
  const bolt = BOLT.map(([x, y]) => [offset + x * unit, offset + y * unit])
  const radius = rounded ? (size * 8) / 32 : 0
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0
      let boltHits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = px + (sx + 0.5) / SAMPLES
          const y = py + (sy + 0.5) / SAMPLES
          if (rounded && !insideRoundedRect(x, y, size, radius)) continue
          bgHits++
          if (insidePolygon(x, y, bolt)) boltHits++
        }
      }
      const total = SAMPLES * SAMPLES
      const i = (py * size + px) * 4
      const mix = bgHits === 0 ? 0 : boltHits / bgHits
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(BG[c] * (1 - mix) + ACCENT[c] * mix)
      rgba[i + 3] = Math.round((bgHits / total) * 255)
    }
  }
  return encodePng(size, rgba)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // Bittiefe
  header[9] = 6 // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const ICONS = [
  { file: 'pwa-192x192.png', size: 192, rounded: true, boltScale: 1 },
  { file: 'pwa-512x512.png', size: 512, rounded: true, boltScale: 1 },
  { file: 'maskable-512x512.png', size: 512, rounded: false, boltScale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, boltScale: 0.85 },
]

for (const { file, size, ...opts } of ICONS) {
  writeFileSync(OUT_DIR + file, render(size, opts))
  console.log(`public/${file} (${size}x${size})`)
}

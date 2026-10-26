// Writes the placeholder icons into public/. No network, no dependency: PNG is encoded by hand.
// Matt swaps in a real icon pack later; keep these file names so the manifest and check stay put.
//   node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0x2a, 0x2f, 0x6b]; // deep indigo
const RING = [0x9a, 0xa6, 0xf0]; // lighter indigo
const SAMPLES = 4; // 4x4 supersampling for smooth edges

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** One sample in unit space (0..1): returns [r, g, b, covered]. */
function sample(x, y, rounded) {
  if (rounded) {
    // Rounded square, corner radius 0.22.
    const r = 0.22;
    const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
    const dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
    if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
  }
  // Ring of outer radius 0.30 and inner radius 0.22, inside the maskable safe zone (0.40).
  const d = Math.hypot(x - 0.5, y - 0.5);
  return d <= 0.3 && d >= 0.22 ? [...RING, 1] : [...BG, 1];
}

function png(size, rounded) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const s = sample(
            (px + (sx + 0.5) / SAMPLES) / size,
            (py + (sy + 0.5) / SAMPLES) / size,
            rounded
          );
          r += s[0] * s[3];
          g += s[1] * s[3];
          b += s[2] * s[3];
          a += s[3];
        }
      }
      const n = SAMPLES * SAMPLES;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = (name) => new URL(`../public/${name}`, import.meta.url);
writeFileSync(out("icon-192.png"), png(192, true));
writeFileSync(out("icon-512.png"), png(512, true));
// Maskable and Apple icons are full bleed: the OS applies its own mask, so no transparent corners.
writeFileSync(out("icon-maskable-512.png"), png(512, false));
writeFileSync(out("apple-touch-icon.png"), png(180, false));
console.log("wrote icon-192, icon-512, icon-maskable-512, apple-touch-icon");

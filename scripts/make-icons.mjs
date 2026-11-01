import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

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
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const NAVY = [11, 16, 32]; // #0b1020
const GOLD = [255, 204, 51]; // #ffcc33
const GOLD_SOFT = [255, 226, 122]; // #ffe27a
const RED = [179, 18, 42]; // #b3122a

/** Five-point star outline (point up) around (cx, cy). */
function starPoints(cx, cy, outer, inner) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** Even-odd ray casting. */
function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Colour at a point of the original star badge: gold rim, red disc, gold star, on navy. Everything stays inside the central 80% (maskable safe zone). */
function badgeColor(x, y, size, star) {
  const d2 = (x - size / 2) ** 2 + (y - size / 2) ** 2;
  if (inPolygon(x, y, star)) return GOLD_SOFT;
  if (d2 < (size * 0.33) ** 2) return RED;
  if (d2 < (size * 0.39) ** 2) return GOLD;
  return NAVY;
}

function png(size) {
  const rowBytes = size * 3 + 1;
  const raw = Buffer.alloc(size * rowBytes);
  const star = starPoints(size / 2, size / 2 + size * 0.01, size * 0.25, size * 0.25 * 0.382);
  const N = 3; // N x N samples per pixel for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const c = badgeColor(x + (sx + 0.5) / N, y + (sy + 0.5) / N, size, star);
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      }
      const o = y * rowBytes + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(sum[k] / (N * N));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
console.log('Icons written to public/');

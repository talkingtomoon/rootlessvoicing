/**
 * 홈 화면 아이콘 PNG 생성 (의존성 없음 — zlib으로 PNG를 직접 쓴다).
 * iOS는 SVG 아이콘을 쓰지 않아서 apple-touch-icon용 PNG가 필요하다.
 *   node scripts/gen-icons.mjs
 * 디자인: 펠트 바탕 + 크림슨 펠트 띠 + 한 옥타브 건반, 루트리스 네 음(♭3 5 ♭7 9 모양)을 크림슨으로.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FELT = hex('#21251f');
const FELT_DEEP = hex('#1a1d18');
const IVORY = hex('#f0eadd');
const EBONY = hex('#1d1b17');
const CRIMSON = hex('#a84a40');
const CRIMSON_DEEP = hex('#7e352c');

function draw(size) {
  const px = new Uint8Array(size * size * 3);
  const set = (x, y, c) => {
    const i = (y * size + x) * 3;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(size, Math.round(y1)); y++)
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(size, Math.round(x1)); x++) set(x, y, c);
  };
  const S = size / 100;
  rect(0, 0, size, size, FELT);

  // 건반 영역: 흰 건반 7개 (C D E F G A B)
  const left = 12 * S;
  const right = 88 * S;
  const top = 30 * S;
  const bottom = 78 * S;
  const ww = (right - left) / 7;
  const gap = Math.max(1, 0.8 * S);
  rect(left, top - 6 * S, right, top, CRIMSON_DEEP); // 펠트 띠
  rect(left - gap, top, right + gap, bottom + gap, FELT_DEEP);
  // Dm7 A형 = F A C E → 한 옥타브 안에서는 F(3) A(5) C(0) E(2) 흰 건반
  const lit = new Set([0, 2, 3, 5]);
  for (let i = 0; i < 7; i++) {
    rect(left + i * ww + gap / 2, top, left + (i + 1) * ww - gap / 2, bottom, lit.has(i) ? CRIMSON : IVORY);
  }
  // 흑건 (C# D# F# G# A#)
  const bw = ww * 0.52;
  for (const i of [1, 2, 4, 5, 6]) {
    const cx = left + i * ww;
    rect(cx - bw / 2, top, cx + bw / 2, top + (bottom - top) * 0.6, EBONY);
  }
  return px;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const px = draw(size);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 3, size * 3).copy(raw, y * (size * 3 + 1) + 1);
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

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(`public/${name}`, png(size));
  console.log(`public/${name}`);
}

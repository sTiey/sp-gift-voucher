/**
 * qr.js — สร้าง QR Code เองในเครื่อง ไม่ต้องพึ่งไลบรารีหรืออินเทอร์เน็ต
 * ---------------------------------------------------------------------------
 * ทำไมต้องเขียนเอง: คูปองต้องเปิดได้แม้เน็ตไม่ดี และห้ามส่งรหัสคูปองของลูกค้า
 * ออกไปให้เว็บภายนอกวาด QR ให้ (นั่นคือการยกข้อมูลลูกค้าให้คนอื่นฟรี ๆ)
 *
 * ขอบเขต: โหมด byte (รองรับทุกตัวอักษร) · ระดับกันพัง M (ซ่อมได้ ~15%)
 *          เวอร์ชัน 1-10 → เก็บได้สูงสุด 213 ตัวอักษร  พอสำหรับลิงก์คูปองสบาย ๆ
 *
 * ผลลัพธ์: matrix ของ true/false → เอาไปวาดเป็น SVG ด้วย toSvg()
 */

/* ── ตารางมาตรฐาน (ISO/IEC 18004) เฉพาะระดับ M เวอร์ชัน 1-10 ─────────────
   ecc          = จำนวนไบต์กันพังต่อบล็อก
   blocks       = [[จำนวนบล็อก, ไบต์ข้อมูลต่อบล็อก], ...]
   align        = ตำแหน่งจุดกึ่งกลางของ alignment pattern                     */
const SPEC_M = {
  1: { ecc: 10, blocks: [[1, 16]], align: [] },
  2: { ecc: 16, blocks: [[1, 28]], align: [6, 18] },
  3: { ecc: 26, blocks: [[1, 44]], align: [6, 22] },
  4: { ecc: 18, blocks: [[2, 32]], align: [6, 26] },
  5: { ecc: 24, blocks: [[2, 43]], align: [6, 30] },
  6: { ecc: 16, blocks: [[4, 27]], align: [6, 34] },
  7: { ecc: 18, blocks: [[4, 31]], align: [6, 22, 38] },
  8: { ecc: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
  9: { ecc: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
  10: { ecc: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] },
};

/* ══════════════ เลขคณิตบนสนามจำกัด GF(256) สำหรับ Reed-Solomon ══════════ */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // พหุนามกำเนิดมาตรฐานของ QR
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * พหุนามกำเนิดของรหัสกันพังขนาด n ไบต์ = (x+α⁰)(x+α¹)...(x+αⁿ⁻¹)
 * เก็บสัมประสิทธิ์เรียงจากดีกรีสูงไปต่ำ  poly[0] คือพจน์นำหน้าเสมอ
 * ⚠️ จุดที่พลาดง่าย: คูณด้วย x = เลื่อน "ตำแหน่งเดิม"  คูณด้วย α = เลื่อนไป "ตำแหน่งถัดไป"
 *    สลับสองบรรทัดนี้ = ได้พหุนามกลับหัว QR สแกนไม่ออกแต่รูปดูปกติทุกอย่าง
 */
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]; // คูณด้วย x
      next[j + 1] ^= gfMul(poly[j], EXP[i]); // คูณด้วย αⁱ
    }
    poly = next;
  }
  return poly;
}

/** คำนวณไบต์กันพังของข้อมูล 1 บล็อก */
function rsEncode(data, eccLen) {
  const gen = rsGenerator(eccLen);
  const res = new Array(eccLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < eccLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

/* ══════════════════════ สร้างสายบิตของข้อมูล ══════════════════════════ */

class BitWriter {
  constructor() { this.bits = []; }
  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length() { return this.bits.length; }
  toBytes() {
    const out = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] || 0);
      out.push(b);
    }
    return out;
  }
}

function utf8Bytes(str) {
  return Array.from(new TextEncoder().encode(str));
}

/** เลือกเวอร์ชันเล็กที่สุดที่ใส่ข้อมูลลงได้ */
function pickVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const spec = SPEC_M[v];
    const dataCodewords = spec.blocks.reduce((s, [n, k]) => s + n * k, 0);
    const countBits = v <= 9 ? 8 : 16;
    const need = 4 + countBits + byteLen * 8;
    if (need <= dataCodewords * 8) return v;
  }
  return null; // ยาวเกิน 213 ไบต์ — ผู้เรียกต้องย่อลิงก์ก่อน
}

/** ข้อมูล + ไบต์กันพัง เรียงสลับตามมาตรฐาน พร้อมเขียนลงตาราง */
function buildCodewords(text) {
  const bytes = utf8Bytes(text);
  const version = pickVersion(bytes.length);
  if (!version) throw new Error('ข้อความยาวเกินที่ QR รุ่นนี้รองรับ (สูงสุด 213 ไบต์)');

  const spec = SPEC_M[version];
  const totalData = spec.blocks.reduce((s, [n, k]) => s + n * k, 0);
  const countBits = version <= 9 ? 8 : 16;

  const bw = new BitWriter();
  bw.put(0b0100, 4); // โหมด byte
  bw.put(bytes.length, countBits);
  for (const b of bytes) bw.put(b, 8);

  // ปิดท้าย + เติมให้เต็มไบต์ + เติมไบต์มาตรฐานสลับกัน
  const capacityBits = totalData * 8;
  bw.put(0, Math.min(4, capacityBits - bw.length));
  while (bw.length % 8 !== 0) bw.put(0, 1);
  const data = bw.toBytes();
  const PAD = [0xec, 0x11];
  let p = 0;
  while (data.length < totalData) data.push(PAD[p++ % 2]);

  // แบ่งเป็นบล็อก + คำนวณกันพังทีละบล็อก
  const dataBlocks = [];
  const eccBlocks = [];
  let offset = 0;
  for (const [count, k] of spec.blocks) {
    for (let i = 0; i < count; i++) {
      const chunk = data.slice(offset, offset + k);
      offset += k;
      dataBlocks.push(chunk);
      eccBlocks.push(rsEncode(chunk, spec.ecc));
    }
  }

  // เรียงสลับ: ไบต์ที่ 0 ของทุกบล็อก แล้วไบต์ที่ 1 ของทุกบล็อก ...
  const result = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of dataBlocks) if (i < blk.length) result.push(blk[i]);
  }
  for (let i = 0; i < spec.ecc; i++) {
    for (const blk of eccBlocks) result.push(blk[i]);
  }
  return { version, codewords: result };
}

/* ══════════════════════ วางลวดลายลงตาราง ══════════════════════════════ */

function makeMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(m, r, c) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const isDark = inRing &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      m[rr][cc] = isDark;
    }
  }
}

function placeAlignment(m, positions) {
  const size = m.length;
  for (const r of positions) {
    for (const c of positions) {
      // ข้ามตำแหน่งที่ทับ finder pattern
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          m[r + dr][c + dc] = ring !== 1;
        }
      }
    }
  }
}

function placeTiming(m) {
  const size = m.length;
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }
}

/** จองที่ว่างของ format info ไว้ก่อน (เติมค่าจริงทีหลัง) */
function reserveFormat(m) {
  const size = m.length;
  for (let i = 0; i <= 8; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = false;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = false;
  }
  m[size - 8][8] = true; // dark module ตายตัว
}

function reserveVersion(m, version) {
  if (version < 7) return;
  const size = m.length;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      m[size - 11 + j][i] = false;
      m[i][size - 11 + j] = false;
    }
  }
}

/** BCH สำหรับ format info (15,5) */
function formatBits(maskId) {
  const eccBits = 0b00; // ระดับ M
  let data = (eccBits << 3) | maskId;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** Golay สำหรับ version info (18,6) */
function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function writeFormat(m, maskId) {
  const size = m.length;
  const bits = formatBits(maskId);
  const bitAt = (i) => ((bits >>> i) & 1) === 1;

  /* สำเนาที่ 1 — ล้อมรอบ finder ซ้ายบน (แนวตั้งคอลัมน์ 8 ต่อด้วยแนวนอนแถว 8)
     ลำดับนี้ตายตัวตามมาตรฐาน วางสลับแถว/คอลัมน์แม้ตำแหน่งเดียว = สแกนไม่ออก */
  for (let i = 0; i <= 5; i++) m[i][8] = bitAt(i);
  m[7][8] = bitAt(6);
  m[8][8] = bitAt(7);
  m[8][7] = bitAt(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bitAt(i);

  /* สำเนาที่ 2 — กระจายไปมุมขวาบนกับซ้ายล่าง เผื่อมุมหนึ่งเลอะ */
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bitAt(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bitAt(i);

  m[size - 8][8] = true; // dark module ตายตัว ต้องเขียนทีหลังเสมอ
}

function writeVersion(m, version) {
  if (version < 7) return;
  const size = m.length;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = i % 3;
    m[size - 11 + c][r] = bit;
    m[r][size - 11 + c] = bit;
  }
}

/** เดินซิกแซกจากขวาล่างขึ้นบน วางบิตข้อมูลลงช่องที่ยังว่าง */
function placeData(m, codewords) {
  const size = m.length;
  let bitIndex = 0;
  const nextBit = () => {
    const byte = codewords[bitIndex >> 3];
    const bit = byte === undefined ? 0 : (byte >>> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit === 1;
  };

  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // ข้ามคอลัมน์ timing
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (m[row][col] !== null) continue;
        m[row][col] = nextBit();
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** คะแนนโทษ ยิ่งน้อยยิ่งอ่านง่าย — เลือก mask ที่คะแนนต่ำสุด */
function penalty(m) {
  const size = m.length;
  let score = 0;

  // กฎ 1: สีเดียวกันติดกัน 5 ช่องขึ้นไป
  for (let i = 0; i < size; i++) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }

  // กฎ 2: บล็อก 2×2 สีเดียวกัน
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // กฎ 3: ลวดลายที่ชนกับ finder pattern
  const P1 = [true, false, true, true, true, false, true, false, false, false, false];
  const P2 = [false, false, false, false, true, false, true, true, true, false, true];
  const hasAt = (line, i, pat) => pat.every((p, k) => line[i + k] === p);
  for (let i = 0; i < size; i++) {
    const row = m[i];
    const col = m.map((r) => r[i]);
    for (let j = 0; j + 11 <= size; j++) {
      if (hasAt(row, j, P1) || hasAt(row, j, P2)) score += 40;
      if (hasAt(col, j, P1) || hasAt(col, j, P2)) score += 40;
    }
  }

  // กฎ 4: สัดส่วนช่องดำห่างจาก 50%
  let dark = 0;
  for (const row of m) for (const cell of row) if (cell) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/**
 * สร้าง QR จากข้อความ
 * @param {string} text
 * @param {{forceMask?:number}} [opt] forceMask ใช้ตอนทดสอบเทียบกับตัวอ้างอิงเท่านั้น
 * @returns {{size:number, modules:boolean[][], version:number, mask:number}}
 */
export function encodeQr(text, opt = {}) {
  const { version, codewords } = buildCodewords(text);
  const size = version * 4 + 17;

  // วางลวดลายตายตัว (เหมือนกันทุก mask)
  const base = makeMatrix(size);
  placeFinder(base, 0, 0);
  placeFinder(base, 0, size - 7);
  placeFinder(base, size - 7, 0);
  placeAlignment(base, SPEC_M[version].align);
  placeTiming(base);
  reserveFormat(base);
  reserveVersion(base, version);
  const fixed = base.map((row) => row.map((c) => c !== null));
  placeData(base, codewords);

  // ลอง mask ทั้ง 8 แบบ เลือกที่คะแนนโทษน้อยสุด
  let best = null;
  const candidates = opt.forceMask != null ? [opt.forceMask] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const id of candidates) {
    const m = base.map((row, r) =>
      row.map((cell, c) => (fixed[r][c] ? cell : cell !== MASKS[id](r, c)))
    );
    writeFormat(m, id);
    writeVersion(m, version);
    const s = penalty(m);
    if (!best || s < best.score) best = { score: s, modules: m, mask: id };
  }

  return { size, modules: best.modules, version, mask: best.mask };
}

/**
 * วาด QR เป็น SVG (สตริง) — ฝังลงหน้าเว็บได้เลย ไม่ต้องมีไฟล์รูป
 * @param {string} text ข้อความ/ลิงก์
 * @param {{scale?:number, quiet?:number, dark?:string, light?:string, radius?:number}} opt
 */
export function toSvg(text, opt = {}) {
  const { modules, size } = encodeQr(text);
  const quiet = opt.quiet ?? 4; // ขอบขาวรอบ QR — มาตรฐานบังคับ 4 ช่อง อย่าลดลง
  const dark = opt.dark ?? '#000';
  const light = opt.light ?? 'none';
  const total = size + quiet * 2;

  // รวมช่องดำที่ติดกันในแนวนอนเป็นเส้นเดียว → ไฟล์เล็กลงมาก
  const parts = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!modules[r][c]) { c++; continue; }
      let len = 1;
      while (c + len < size && modules[r][c + len]) len++;
      parts.push(`M${c + quiet} ${r + quiet}h${len}v1h-${len}z`);
      c += len;
    }
  }
  const bg = light === 'none' ? '' : `<rect width="${total}" height="${total}" fill="${light}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR">${bg}<path fill="${dark}" d="${parts.join('')}"/></svg>`;
}

/** ความยาวสูงสุดที่รองรับ (ไบต์ UTF-8) */
export const MAX_BYTES = 213;

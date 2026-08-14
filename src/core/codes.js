/**
 * codes.js — สร้าง / ตรวจ / จัดรูปแบบ "รหัสคูปอง"
 * ---------------------------------------------------------------------------
 * รูปแบบ:  PREFIX-XXXX-XXXC     เช่น  SPE-7K4M-92XQ
 *          PREFIX = อักษรนำหน้าของแคมเปญ (2-4 ตัว)
 *          X      = ตัวสุ่ม
 *          C      = ตัวตรวจทาน (check character) ตัวสุดท้าย
 *
 * ทำไมต้องมีตัวตรวจทาน:
 *   พนักงานพิมพ์รหัสผิด 1 ตัวเป็นเรื่องปกติมาก  ตัวนี้ทำให้ระบบ "รู้ทันที"
 *   ว่าพิมพ์ผิด โดยไม่ต้องยิงไปถามฐานข้อมูล และไม่หลอกว่า "ไม่พบคูปอง"
 *
 * ⚠️ ตัวตรวจทาน ≠ ความปลอดภัย
 *   มันแค่กันพิมพ์ผิด  ความปลอดภัยจริงมาจาก (1) ความสุ่ม 32^7 ≈ 3.4 หมื่นล้าน
 *   และ (2) ฝั่งหลังบ้านเป็นคนตัดสินว่าใช้ได้จริงไหม  ห้ามให้หน้าเว็บตัดสินเอง
 */

/**
 * ตัวอักษรที่ใช้ = Crockford Base32 (มาตรฐานที่ออกแบบมาให้คนอ่าน/พูดต่อกันได้)
 * ตัดตัวที่อ่านสลับกันออก: I · L · O · U   เหลือพอดี 32 ตัว
 *
 * ข้อดีที่ได้ฟรี: ถ้าใครพิมพ์ตัวที่ถูกตัดออกมา เรา "รู้แน่ ๆ ว่าเขาหมายถึงตัวไหน"
 *   O → 0     I → 1     L → 1     U → V
 * จึงซ่อมให้อัตโนมัติได้โดยไม่ต้องเดา (ดู normalizeCode)
 * ที่ตัด U ออกด้วยเพราะกันคำหยาบโผล่ในรหัสโดยบังเอิญ
 */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BASE = ALPHABET.length; // 32

/** ตัวที่คนพิมพ์ผิดบ่อย → ตัวจริงที่ตั้งใจ */
const REPAIR = { O: '0', I: '1', L: '1', U: 'V' };

/** จำนวนตัวอักษรของส่วนรหัส (ไม่รวม prefix) — ใช้แยก prefix ออกจาก body */
export const BODY_LENGTH = 8;

/** สุ่มตัวอักษรอย่างปลอดภัย (ใช้ crypto ถ้ามี ไม่งั้นถอยไป Math.random) */
function randomChars(n) {
  const out = [];
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint8Array(n * 2);
    cryptoObj.getRandomValues(buf);
    let i = 0;
    while (out.length < n && i < buf.length) {
      const b = buf[i++];
      // ตัดค่าที่ทำให้การสุ่มเอนเอียง (rejection sampling)
      if (b < 256 - (256 % BASE)) out.push(ALPHABET[b % BASE]);
    }
  }
  while (out.length < n) out.push(ALPHABET[Math.floor(Math.random() * BASE)]);
  return out.join('');
}

/**
 * คำนวณตัวตรวจทานจากตัวอักษรของรหัส (ไม่รวมขีดและ prefix)
 * ใช้ผลรวมถ่วงน้ำหนักตามตำแหน่ง — จับ "พิมพ์ผิด 1 ตัว" ได้ 100%
 * และจับ "สลับตำแหน่งติดกัน" ได้เกือบทั้งหมด
 */
export function checkChar(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const idx = ALPHABET.indexOf(body[i]);
    if (idx < 0) return null;
    sum += idx * (i % 2 === 0 ? 3 : 1) + i;
  }
  return ALPHABET[sum % BASE];
}

/**
 * สร้างรหัสใหม่ 1 ใบ
 * @param {{prefix?:string, groups?:number, groupSize?:number}} opt
 */
export function generateCode(opt = {}) {
  const prefix = normalizePrefix(opt.prefix ?? 'GV');
  const groups = opt.groups ?? 2;
  const groupSize = opt.groupSize ?? 4;
  const bodyLen = groups * groupSize - 1; // เว้นที่ให้ตัวตรวจทาน 1 ตัว
  const body = randomChars(bodyLen);
  const full = body + checkChar(body);
  const parts = [];
  for (let i = 0; i < full.length; i += groupSize) parts.push(full.slice(i, i + groupSize));
  return `${prefix}-${parts.join('-')}`;
}

/** สร้างหลายใบแบบไม่ซ้ำกัน */
export function generateCodes(count, opt = {}) {
  const seen = new Set();
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 50) {
    guard++;
    const c = generateCode(opt);
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** ทำให้ prefix เป็นตัวใหญ่ 2-4 ตัวเสมอ */
export function normalizePrefix(p) {
  const clean = String(p || 'GV').toUpperCase().replace(/[^A-Z]/g, '');
  return (clean || 'GV').slice(0, 4);
}

/**
 * แยก "อักษรนำหน้า" ออกจาก "ตัวรหัส"
 * - ถ้ามีขีด: ก้อนแรกคือ prefix ที่เหลือคือ body   (ชัดเจน ไม่ต้องเดา)
 * - ถ้าไม่มีขีด: ตัดท้าย BODY_LENGTH ตัวเป็น body  (เพราะตัวรหัสยาวคงที่)
 *   ⚠️ ห้ามใช้ regex เดาว่า "ตัวอักษรข้างหน้าคือ prefix" — ชุดตัวอักษรมีทั้งเลข
 *      และตัวอักษร มันจะเดาแบ่งผิดแล้วไปค้นหาคูปองไม่เจอทั้งที่รหัสถูก
 */
function splitPrefixBody(raw) {
  if (!raw) return null;
  const dash = raw.indexOf('-');
  if (dash > 0) {
    return { prefix: raw.slice(0, dash), body: raw.slice(dash + 1).replace(/-/g, '') };
  }
  if (raw.length <= BODY_LENGTH) return null;
  return { prefix: raw.slice(0, raw.length - BODY_LENGTH), body: raw.slice(-BODY_LENGTH) };
}

/**
 * ทำความสะอาดสิ่งที่ผู้ใช้พิมพ์เข้ามา ก่อนส่งให้ parseCode
 * - ตัดช่องว่าง / ขีดล่าง  - แปลงตัวเล็กเป็นตัวใหญ่
 * - ซ่อมตัวที่คนพิมพ์ผิดบ่อย (O→0, I/L→1, U→V) ซึ่งซ่อมได้อย่างไม่กำกวม
 *   เพราะตัวเหล่านั้นไม่มีอยู่ในชุดตัวอักษรตั้งแต่แรก
 *
 * ⚠️ ต้องแยก prefix ออกก่อนแล้วค่อยซ่อม "เฉพาะตัวรหัส"
 *    prefix เป็นคำที่แคมเปญตั้งเอง มี I/O/L ได้ตามปกติ
 *    (เคยพลาดมาแล้ว: พิมพ์ ship4c7b8xjr ติดกันไม่มีขีด แล้วกลายเป็น SH1P- → หาไม่เจอ)
 */
export function normalizeCode(input) {
  const s = String(input || '').toUpperCase().replace(/[\s_]/g, '');
  const split = splitPrefixBody(s);
  if (!split) return s;
  return joinCode(split.prefix, split.body.replace(/[OILU]/g, (c) => REPAIR[c]));
}

/**
 * ตรวจว่ารหัสมีรูปแบบถูกและตัวตรวจทานตรงไหม
 * @returns {{ok:boolean, reason?:string, prefix?:string, body?:string, code?:string}}
 */
export function parseCode(input) {
  const raw = normalizeCode(input);
  const split = splitPrefixBody(raw);
  if (!split) return { ok: false, reason: 'bad_code' };
  const { prefix, body } = split;

  if (!/^[A-Z]{1,4}$/.test(prefix)) return { ok: false, reason: 'bad_code' };
  if (body.length < 4) return { ok: false, reason: 'bad_code' };
  for (const ch of body) {
    if (ALPHABET.indexOf(ch) < 0) return { ok: false, reason: 'bad_code' };
  }
  const expect = checkChar(body.slice(0, -1));
  if (expect !== body[body.length - 1]) return { ok: false, reason: 'bad_code' };

  return { ok: true, prefix, body, code: joinCode(prefix, body) };
}

/** ประกอบรหัสให้อยู่ในรูปมาตรฐาน PREFIX-XXXX-XXXX */
function joinCode(prefix, body, groupSize = 4) {
  const parts = [];
  for (let i = 0; i < body.length; i += groupSize) parts.push(body.slice(i, i + groupSize));
  return `${prefix}-${parts.join('-')}`;
}

/** ใส่ขีดให้สวยตามรูปแบบมาตรฐาน (กลุ่มละ 4) — ใช้กับช่องกรอกที่พิมพ์อยู่ */
export function formatCode(code, groupSize = 4) {
  const raw = normalizeCode(code);
  const split = splitPrefixBody(raw);
  if (!split) return raw;
  return joinCode(split.prefix, split.body, groupSize);
}

/** ลิงก์เปิดคูปองใบเดียว — ใช้ทั้งใน QR และในลิงก์ที่ส่งให้ลูกค้า */
export function voucherUrl(code, base = '') {
  const b = base || (typeof location !== 'undefined' ? `${location.origin}${location.pathname.replace(/[^/]*$/, '')}voucher.html` : '');
  return `${b}?c=${encodeURIComponent(code)}`;
}

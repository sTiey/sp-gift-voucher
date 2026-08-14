/**
 * security.js — "รหัสยืนยันสด" ที่ภาพหน้าจอปลอมไม่ได้
 * ---------------------------------------------------------------------------
 * ปัญหาจริงของคูปองออนไลน์: ลูกค้าแคปหน้าจอส่งต่อให้เพื่อน แล้วเพื่อนเอาไปใช้
 * ทางแก้ที่ร้านค้าทั่วโลกใช้: โชว์ตัวเลข 4 หลักที่ "เปลี่ยนเองทุก 30 วินาที"
 * พนักงานเทียบกับเลขบนเครื่องตัวเอง — ภาพหน้าจอเก่าจะได้เลขไม่ตรงทันที
 *
 * ⚠️ สำคัญมาก — ของจริงต้องคิดฝั่งหลังบ้าน
 *   ไฟล์นี้คิดในเบราว์เซอร์เพื่อให้ตัวอย่างเดินได้  ซึ่งแปลว่า "ความลับอยู่ในหน้าเว็บ"
 *   = ปลอมได้ถ้าตั้งใจ  ตอนต่อของจริงให้ย้ายไปคำนวณด้วย HMAC-SHA256 บนเซิร์ฟเวอร์
 *   แล้วให้หน้าเว็บแค่ "ขอเลขมาโชว์"  (วิธีทำอยู่ใน docs/05-ความปลอดภัย.md)
 */

const DIGITS = '0123456789';

/** อายุของรหัส 1 รอบ (มิลลิวินาที) */
export const LIVE_CODE_PERIOD = 30_000;

/** ความลับสำหรับตัวอย่าง — ของจริงต้องอยู่บนเซิร์ฟเวอร์เท่านั้น */
let demoSecret = 'voucherkit-demo-secret';

export function setDemoSecret(s) {
  demoSecret = String(s || '');
}

/** แฮชแบบ FNV-1a 32 บิต + คลุกซ้ำ — เร็ว พอสำหรับตัวอย่าง ไม่ใช่ของเข้ารหัส */
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // คลุกอีกชั้นให้บิตกระจาย
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** หมายเลขรอบเวลาปัจจุบัน */
export function currentWindow(now = Date.now()) {
  return Math.floor(now / LIVE_CODE_PERIOD);
}

/**
 * รหัสยืนยันสด 4 หลักของคูปองใบหนึ่ง ณ เวลาหนึ่ง
 * @param {string} voucherId
 */
export function liveCode(voucherId, now = Date.now(), digits = 4) {
  const w = currentWindow(now);
  const h = hash32(`${demoSecret}|${voucherId}|${w}`);
  let n = h % 10 ** digits;
  let s = String(n).padStart(digits, '0');
  // กันเคสได้เลขซ้ำกันหมด (0000/1111) ซึ่งดูเหมือนระบบพัง
  if (/^(\d)\1+$/.test(s)) {
    n = (n + 7) % 10 ** digits;
    s = String(n).padStart(digits, '0');
  }
  return s;
}

/**
 * ตรวจรหัสที่พนักงานกรอก — ยอมรับรอบก่อนหน้า 1 รอบด้วย
 * เพราะลูกค้าอ่านเลขให้ฟังอาจกินเวลาข้ามรอบพอดี
 */
export function verifyLiveCode(voucherId, input, now = Date.now()) {
  const given = String(input || '').replace(/\D/g, '');
  if (!given) return false;
  return (
    given === liveCode(voucherId, now) ||
    given === liveCode(voucherId, now - LIVE_CODE_PERIOD)
  );
}

/** เหลืออีกกี่มิลลิวินาทีรหัสจะเปลี่ยน — เอาไปวาดวงแหวนนับถอยหลัง */
export function msUntilRotate(now = Date.now()) {
  return LIVE_CODE_PERIOD - (now % LIVE_CODE_PERIOD);
}

/** สร้างไอดีแบบสุ่ม (ใช้เป็น id ของคูปอง/แคมเปญ) */
export function newId(prefix = 'v') {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return `${prefix}_${c.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let s = '';
  for (let i = 0; i < 16; i++) s += DIGITS[Math.floor(Math.random() * 10)];
  return `${prefix}_${s}`;
}

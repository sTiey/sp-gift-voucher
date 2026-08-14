/**
 * lifecycle.js — "คูปองใบนี้ตอนนี้อยู่สถานะอะไร"
 * ---------------------------------------------------------------------------
 * แยกให้ชัด 2 คำ:
 *   state  = สิ่งที่ "คนทำ" แล้วเก็บลงฐานข้อมูล (draft/issued/reserved/redeemed/void)
 *   status = สิ่งที่ "ผู้ใช้เห็น" คำนวณสดจาก state + เวลา + โควตา
 *            (draft/scheduled/active/reserved/redeemed/expired/void)
 *
 * ทำไมต้องแยก: ถ้าเก็บ 'expired' ลงฐานข้อมูล จะต้องมีงานเบื้องหลังคอยไล่อัปเดต
 * ทุกใบทุกวัน — พังง่ายและช้า  คำนวณสดจากวันหมดอายุจบกว่ามาก
 */

/** ลำดับความสำคัญเวลาจัดเรียงในกระเป๋าคูปอง (เลขน้อย = อยู่บน) */
export const STATUS_ORDER = {
  active: 0,
  reserved: 1,
  scheduled: 2,
  redeemed: 3,
  expired: 4,
  void: 5,
  draft: 6,
};

/** สถานะที่ถือว่า "จบแล้ว" — ย้ายไปแท็บประวัติ */
export const CLOSED_STATUSES = new Set(['redeemed', 'expired', 'void']);

const ms = (d) => (d ? new Date(d).getTime() : null);

/**
 * คำนวณสถานะที่ผู้ใช้เห็น
 * @param {object} v คูปอง
 * @param {Date|number} [now] เวลาอ้างอิง (ใส่เองได้เพื่อทดสอบ)
 */
export function deriveStatus(v, now = Date.now()) {
  const t = now instanceof Date ? now.getTime() : now;

  if (v.state === 'void') return 'void';
  if (v.state === 'draft') return 'draft';
  if (v.state === 'redeemed') return 'redeemed';

  const until = ms(v.validUntil);
  if (until != null && t > until) return 'expired';

  // โควตารวมหมด = ใช้ไม่ได้แล้ว ถือว่าปิด
  if (v.limits.total != null && v.usage.used >= v.limits.total) return 'redeemed';

  if (v.state === 'reserved') {
    const hold = ms(v.reservedUntil);
    // จองค้างไว้เกินเวลา = ปล่อยกลับมาใช้ได้เอง (กันคูปองค้างเพราะปิดหน้าเว็บหนี)
    if (hold != null && t <= hold) return 'reserved';
  }

  const from = ms(v.validFrom);
  if (from != null && t < from) return 'scheduled';

  return 'active';
}

/** ใช้สิทธิ์ได้ตอนนี้ไหม */
export function isUsable(v, now = Date.now()) {
  return deriveStatus(v, now) === 'active';
}

/** เหลือกี่วัน — คืน null ถ้าไม่มีวันหมดอายุ */
export function daysLeft(v, now = Date.now()) {
  const until = ms(v.validUntil);
  if (until == null) return null;
  const t = now instanceof Date ? now.getTime() : now;
  return Math.ceil((until - t) / 86400000);
}

/** เหลือกี่สิทธิ์ — คืน null ถ้าไม่จำกัด */
export function remainingUses(v) {
  if (v.limits.total == null) return null;
  return Math.max(0, v.limits.total - v.usage.used);
}

/** ใกล้หมดอายุจนควรเตือนไหม (ค่าเริ่มต้น 7 วัน) */
export function isEndingSoon(v, withinDays = 7, now = Date.now()) {
  const d = daysLeft(v, now);
  return d != null && d >= 0 && d <= withinDays && deriveStatus(v, now) === 'active';
}

/** เรียงคูปองแบบที่คนอยากเห็น: ใช้ได้ก่อน แล้วเรียงตามใกล้หมดอายุ */
export function sortForWallet(list, now = Date.now()) {
  return [...list].sort((a, b) => {
    const sa = STATUS_ORDER[deriveStatus(a, now)] ?? 9;
    const sb = STATUS_ORDER[deriveStatus(b, now)] ?? 9;
    if (sa !== sb) return sa - sb;
    const da = daysLeft(a, now);
    const db = daysLeft(b, now);
    if (da == null && db == null) return 0;
    if (da == null) return 1; // ไม่มีวันหมด = ไม่เร่ง อยู่ล่าง
    if (db == null) return -1;
    return da - db;
  });
}

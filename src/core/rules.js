/**
 * rules.js — สมองของระบบ: "ใบนี้ใช้กับตะกร้านี้ได้ไหม และลดเท่าไหร่"
 * ---------------------------------------------------------------------------
 * ฟังก์ชันเดียวที่ต้องรู้จักคือ evaluate(voucher, context)
 *
 * ออกแบบให้เป็น "ฟังก์ชันบริสุทธิ์" (pure) — ใส่ข้อมูลเข้า ได้คำตอบออก
 * ไม่แตะฐานข้อมูล ไม่แตะหน้าจอ  →  เอาไปรันฝั่งหลังบ้านด้วยโค้ดชุดเดียวกันได้เลย
 * ซึ่งสำคัญมาก เพราะหน้าเว็บกับหลังบ้าน "ต้องคิดเลขตรงกัน" ไม่งั้นลูกค้าเห็นราคาหนึ่ง
 * แต่ตอนจ่ายจริงอีกราคาหนึ่ง
 *
 * ⚠️ ผลจากหน้าเว็บใช้ "แสดงผล" เท่านั้น  การตัดสินจริงต้องเกิดฝั่งหลังบ้านเสมอ
 */

import { deriveStatus } from './lifecycle.js';

/**
 * ลำดับความสำคัญของเหตุผลที่ใช้ไม่ได้ — เรียงจาก "ต้องบอกก่อน" ไป "รองลงมา"
 * ใบเดียวติดได้หลายข้อพร้อมกัน แต่หน้าจอควรบอกข้อเดียวที่ตรงใจที่สุด
 * (เช่น ใบที่ใช้ไปแล้ว ต้องบอกว่า "ใช้แล้ว" ไม่ใช่ "ใช้สิทธิ์ครบจำนวน")
 */
export const REASON_PRIORITY = [
  'bad_code', 'not_found', 'voided', 'already_redeemed', 'expired',
  'not_started', 'reserved', 'wrong_customer', 'segment',
  'limit_total', 'limit_per_person', 'channel', 'branch',
  'product_scope', 'min_spend', 'not_combinable',
];

const rank = (r) => {
  const i = REASON_PRIORITY.indexOf(r);
  return i < 0 ? REASON_PRIORITY.length : i;
};

/** เหตุผลข้อเดียวที่ควรเอาไปโชว์ */
export function primaryReason(reasons = []) {
  if (!reasons.length) return null;
  return [...reasons].sort((a, b) => rank(a) - rank(b))[0];
}

/** บริบทของการใช้สิทธิ์ 1 ครั้ง — ทุก field เป็นตัวเลือก */
export function contextDefaults() {
  return {
    now: Date.now(),
    orderTotal: 0, // ยอดก่อนลด (บาท)
    items: [], // [{sku, category, price, qty}]
    customerId: null,
    segments: ['public'], // กลุ่มที่ลูกค้าคนนี้เป็นอยู่
    channel: null, // 'web' | 'app' | 'store' | 'line' ...
    branch: null,
    hasOtherDiscount: false,
  };
}

/** ปัดเศษเงินให้ลงตัวระดับสตางค์ */
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/** ยอดที่คูปองใบนี้ "มีสิทธิ์ลดได้" — ถ้าจำกัดสินค้าไว้ จะนับเฉพาะที่เข้าเงื่อนไข */
export function eligibleSubtotal(v, ctx) {
  const scope = v.conditions.productScope || {};
  const hasFilter =
    (scope.include && scope.include.length) ||
    (scope.categories && scope.categories.length) ||
    (scope.exclude && scope.exclude.length);

  if (!hasFilter || !ctx.items || ctx.items.length === 0) return ctx.orderTotal;

  let sum = 0;
  for (const it of ctx.items) {
    if (scope.exclude?.includes(it.sku)) continue;
    const inSku = scope.include?.length ? scope.include.includes(it.sku) : null;
    const inCat = scope.categories?.length ? scope.categories.includes(it.category) : null;
    // ถ้ามีตัวกรองทั้งสองแบบ เข้าอย่างใดอย่างหนึ่งก็นับ
    const pass = inSku === null && inCat === null ? true : Boolean(inSku) || Boolean(inCat);
    if (pass) sum += (it.price || 0) * (it.qty || 1);
  }
  return roundMoney(sum);
}

/** คำนวณส่วนลดจากยอดที่มีสิทธิ์ (ไม่สนใจเงื่อนไข — ใช้ต่อจาก evaluate) */
export function computeDiscount(v, base) {
  switch (v.kind) {
    case 'percent': {
      let d = (base * v.value) / 100;
      if (v.conditions.maxDiscount != null) d = Math.min(d, v.conditions.maxDiscount);
      return roundMoney(Math.min(d, base));
    }
    case 'amount':
      return roundMoney(Math.min(v.value, base));
    case 'fixed_price':
      return roundMoney(Math.max(0, base - v.value));
    case 'free_shipping':
    case 'free_item':
    default:
      return 0;
  }
}

/**
 * ตรวจครบทุกเงื่อนไข + คำนวณส่วนลด
 * @returns {{
 *   ok:boolean, reasons:string[], status:string,
 *   base:number, discount:number, payable:number,
 *   freeShipping:boolean, freeItems:number
 * }}
 * reasons ใช้คีย์เดียวกับ strings.th.js หัวข้อ reject.* → เอาไปโชว์ได้เลย
 */
export function evaluate(voucher, context = {}) {
  const v = voucher;
  const ctx = { ...contextDefaults(), ...context };
  const reasons = [];
  const status = deriveStatus(v, ctx.now);

  /* --- 1. สถานะของใบเอง --- */
  if (status === 'void') reasons.push('voided');
  else if (status === 'redeemed') reasons.push('already_redeemed');
  else if (status === 'expired') reasons.push('expired');
  else if (status === 'scheduled') reasons.push('not_started');
  else if (status === 'reserved') reasons.push('reserved');
  else if (status === 'draft') reasons.push('voided');

  /* --- 2. ใครใช้ได้ --- */
  const segs = v.audience.segments || ['public'];
  if (!segs.includes('public')) {
    const mine = ctx.segments || [];
    if (!segs.some((s) => mine.includes(s))) reasons.push('segment');
  }
  if (v.audience.customerId && ctx.customerId && v.audience.customerId !== ctx.customerId) {
    reasons.push('wrong_customer');
  }

  /* --- 3. ช่องทาง / สาขา --- */
  const ch = v.conditions.channels || [];
  if (ch.length && ctx.channel && !ch.includes(ctx.channel)) reasons.push('channel');
  const br = v.conditions.branches || [];
  if (br.length && ctx.branch && !br.includes(ctx.branch)) reasons.push('branch');

  /* --- 4. โควตา --- */
  if (v.limits.total != null && v.usage.used >= v.limits.total) reasons.push('limit_total');
  if (ctx.customerId && v.limits.perPerson != null) {
    const mine = v.usage.byCustomer?.[ctx.customerId] || 0;
    if (mine >= v.limits.perPerson) reasons.push('limit_per_person');
  }

  /* --- 5. ใช้ร่วมกับส่วนลดอื่น --- */
  if (ctx.hasOtherDiscount && !v.conditions.combinable) reasons.push('not_combinable');

  /* --- 6. ยอด / สินค้า --- */
  const base = eligibleSubtotal(v, ctx);
  if (v.conditions.minSpend != null && ctx.orderTotal < v.conditions.minSpend) {
    reasons.push('min_spend');
  }
  const scope = v.conditions.productScope || {};
  const hasScope =
    (scope.include?.length || 0) + (scope.categories?.length || 0) > 0;
  if (hasScope && ctx.items?.length && base <= 0) reasons.push('product_scope');

  /* --- 7. สรุป --- */
  const ok = reasons.length === 0;
  const discount = ok ? computeDiscount(v, base) : 0;

  return {
    ok,
    // เรียงตามลำดับความสำคัญเสมอ → reasons[0] คือข้อที่ควรโชว์
    reasons: [...new Set(reasons)].sort((a, b) => rank(a) - rank(b)),
    status,
    base,
    discount,
    payable: roundMoney(Math.max(0, ctx.orderTotal - discount)),
    freeShipping: ok && v.kind === 'free_shipping',
    freeItems: ok && v.kind === 'free_item' ? v.value || 1 : 0,
  };
}

/**
 * เลือกคูปองที่ "คุ้มที่สุด" จากหลายใบสำหรับตะกร้าเดียว
 * ใช้ตอนลูกค้ามีคูปองหลายใบแล้วอยากให้ระบบเลือกให้
 */
export function bestVoucher(list, context = {}) {
  let best = null;
  for (const v of list) {
    const r = evaluate(v, context);
    if (!r.ok) continue;
    const worth = r.discount + (r.freeShipping ? 0.5 : 0); // ส่งฟรีถือว่ามีค่าเล็กน้อยเวลาเสมอ
    if (!best || worth > best.worth) best = { voucher: v, result: r, worth };
  }
  return best;
}

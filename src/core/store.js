/**
 * store.js — ที่เก็บคูปอง + คำสั่งที่ใช้จริงในงานประจำวัน
 * ---------------------------------------------------------------------------
 * แยกเป็น 2 ชั้นโดยตั้งใจ:
 *
 *   ชั้นที่ 1  Adapter  = "เก็บที่ไหน"   (ในหน่วยความจำ / ในเบราว์เซอร์ / ใน API จริง)
 *   ชั้นที่ 2  Service  = "ทำอะไรได้"    (ออกคูปอง / ตรวจ / จอง / ตัดสิทธิ์)
 *
 * ทำไมถึงสำคัญ: วันหน้าจะย้ายไปต่อ API ของบริษัท ก็เขียน Adapter ตัวใหม่ตัวเดียว
 * โดย "ไม่ต้องแตะหน้าเว็บเลยสักบรรทัด"  — สัญญาของ Adapter มีแค่ 5 เมธอดข้างล่างนี้
 *
 *   list()            → คูปองทั้งหมด (array)
 *   get(code)         → คูปอง 1 ใบ หรือ null
 *   put(voucher)      → เขียนทับ/เพิ่ม
 *   remove(code)      → ลบ
 *   clear()           → ล้างทั้งหมด
 */

import { createVoucher, validateVoucher } from './schema.js';
import { generateCodes, normalizePrefix, parseCode, normalizeCode } from './codes.js';
import { evaluate } from './rules.js';
import { deriveStatus } from './lifecycle.js';
import { newId } from './security.js';

/* ══════════════════════ ชั้นที่ 1 · ที่เก็บข้อมูล ══════════════════════ */

/** เก็บในหน่วยความจำ — หายเมื่อรีเฟรช เหมาะกับเทสต์ */
export class MemoryStore {
  constructor(seed = []) {
    this.map = new Map(seed.map((v) => [v.code, v]));
  }
  list() { return [...this.map.values()]; }
  get(code) { return this.map.get(code) || null; }
  put(v) { this.map.set(v.code, v); return v; }
  remove(code) { return this.map.delete(code); }
  clear() { this.map.clear(); }
}

/** เก็บใน localStorage ของเบราว์เซอร์ — อยู่ข้ามการรีเฟรช เหมาะกับตัวอย่าง/ต้นแบบ */
export class LocalStore {
  constructor(key = 'voucherkit.v1') {
    this.key = key;
  }
  #read() {
    try {
      const raw = globalThis.localStorage?.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  #write(obj) {
    try { globalThis.localStorage?.setItem(this.key, JSON.stringify(obj)); } catch { /* โหมดส่วนตัวเขียนไม่ได้ — ปล่อยผ่าน */ }
  }
  list() { return Object.values(this.#read()); }
  get(code) { return this.#read()[code] || null; }
  put(v) { const o = this.#read(); o[v.code] = v; this.#write(o); return v; }
  remove(code) { const o = this.#read(); const had = code in o; delete o[code]; this.#write(o); return had; }
  clear() { this.#write({}); }
}

/**
 * ตัวอย่างโครง Adapter สำหรับต่อ API จริง — ก๊อปไปแก้ URL แล้วใช้ได้เลย
 * (เมธอดเป็น async ได้ Service รองรับทั้งแบบ sync และ async)
 */
export class HttpStore {
  constructor(baseUrl, fetchImpl = globalThis.fetch) {
    this.base = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }
  async list() { return (await this.fetch(`${this.base}/vouchers`)).json(); }
  async get(code) {
    const r = await this.fetch(`${this.base}/vouchers/${encodeURIComponent(code)}`);
    return r.ok ? r.json() : null;
  }
  async put(v) {
    await this.fetch(`${this.base}/vouchers/${encodeURIComponent(v.code)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(v),
    });
    return v;
  }
  async remove(code) {
    const r = await this.fetch(`${this.base}/vouchers/${encodeURIComponent(code)}`, { method: 'DELETE' });
    return r.ok;
  }
  async clear() { await this.fetch(`${this.base}/vouchers`, { method: 'DELETE' }); }
}

/* ══════════════════════ ชั้นที่ 2 · คำสั่งที่ใช้งานจริง ══════════════════ */

/** เวลาที่ล็อกคูปองไว้ระหว่างลูกค้ากำลังจ่ายเงิน (5 นาที) */
export const RESERVE_MS = 5 * 60 * 1000;

export class VoucherService {
  /** @param {{list:Function,get:Function,put:Function,remove:Function,clear:Function}} store */
  constructor(store = new MemoryStore()) {
    this.store = store;
    this.listeners = new Set();
  }

  /** ฟังการเปลี่ยนแปลง — ใช้ให้หน้าจอวาดใหม่เอง */
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  #emit(type, payload) { for (const fn of this.listeners) fn({ type, ...payload }); }

  /* ---------- อ่าน ---------- */

  async all() { return (await this.store.list()) || []; }

  /** หาคูปองจากรหัสที่ผู้ใช้พิมพ์ — ตรวจตัวตรวจทานให้ด้วย */
  async find(input) {
    const parsed = parseCode(normalizeCode(input));
    if (!parsed.ok) return { ok: false, reason: 'bad_code', voucher: null };
    const v = await this.store.get(parsed.code);
    if (!v) return { ok: false, reason: 'not_found', voucher: null };
    return { ok: true, voucher: v };
  }

  /** ตรวจว่าใช้ได้ไหมกับตะกร้าที่ให้มา (ไม่ตัดสิทธิ์) */
  async check(input, context = {}) {
    const found = await this.find(input);
    if (!found.ok) {
      return { ok: false, reasons: [found.reason], voucher: null, discount: 0, payable: context.orderTotal || 0 };
    }
    return { ...evaluate(found.voucher, context), voucher: found.voucher };
  }

  /* ---------- เขียน ---------- */

  /**
   * ออกคูปองใหม่หลายใบจาก "แม่พิมพ์" เดียว
   * @param {object} template ค่าที่อยากให้ทุกใบเหมือนกัน (ตาม schema)
   * @param {{count?:number, prefix?:string}} opt
   */
  async issue(template = {}, opt = {}) {
    const count = Math.max(1, opt.count || 1);
    const prefix = normalizePrefix(opt.prefix || template.codePrefix || 'GV');
    const codes = generateCodes(count, { prefix });
    const made = [];
    for (const code of codes) {
      const v = createVoucher({ ...template, id: newId('v'), code, state: template.state || 'issued' });
      const problems = validateVoucher(v);
      if (problems.length) throw new Error(`ออกคูปองไม่ได้: ${problems.join(' · ')}`);
      await this.store.put(v);
      made.push(v);
    }
    this.#emit('issued', { vouchers: made });
    return made;
  }

  /** ล็อกไว้ชั่วคราวระหว่างลูกค้ากำลังจ่ายเงิน (กันใช้ซ้ำสองเครื่องพร้อมกัน) */
  async reserve(input, ms = RESERVE_MS) {
    const found = await this.find(input);
    if (!found.ok) return { ok: false, reasons: [found.reason] };
    const v = found.voucher;
    const status = deriveStatus(v);
    if (status !== 'active') return { ok: false, reasons: [statusToReason(status)] };
    v.state = 'reserved';
    v.reservedUntil = new Date(Date.now() + ms).toISOString();
    await this.store.put(v);
    this.#emit('reserved', { voucher: v });
    return { ok: true, voucher: v };
  }

  /** ยกเลิกการล็อก (ลูกค้ากดยกเลิกตอนจ่ายเงิน) */
  async release(input) {
    const found = await this.find(input);
    if (!found.ok) return { ok: false, reasons: [found.reason] };
    const v = found.voucher;
    if (v.state === 'reserved') {
      v.state = 'issued';
      v.reservedUntil = null;
      await this.store.put(v);
      this.#emit('released', { voucher: v });
    }
    return { ok: true, voucher: v };
  }

  /**
   * ตัดสิทธิ์จริง — จุดเดียวในระบบที่ทำให้คูปอง "ใช้แล้ว"
   * @param {object} context บริบทตอนใช้ (ยอด/ลูกค้า/สาขา) เพื่อคำนวณและเก็บประวัติ
   */
  async redeem(input, context = {}) {
    const found = await this.find(input);
    if (!found.ok) return { ok: false, reasons: [found.reason], voucher: null };
    const v = found.voucher;

    // คูปองที่ตัวเองล็อกไว้ ให้ผ่านด่าน "reserved" ได้
    const wasReserved = v.state === 'reserved';
    if (wasReserved) v.state = 'issued';
    const result = evaluate(v, context);
    if (!result.ok) {
      if (wasReserved) v.state = 'reserved';
      return { ...result, voucher: v };
    }

    v.usage.used += 1;
    if (context.customerId) {
      v.usage.byCustomer[context.customerId] = (v.usage.byCustomer[context.customerId] || 0) + 1;
    }
    const limitReached = v.limits.total == null ? true : v.usage.used >= v.limits.total;
    v.state = limitReached ? 'redeemed' : 'issued';
    v.reservedUntil = null;
    v.redeemedAt = new Date().toISOString();
    v.redeemedBy = context.staffId || context.branch || null;

    await this.store.put(v);
    this.#emit('redeemed', { voucher: v, result });
    return { ...result, voucher: v };
  }

  /** ยกเลิกคูปอง (แอดมิน) */
  async voidCode(input, reason = '') {
    const found = await this.find(input);
    if (!found.ok) return { ok: false, reasons: [found.reason] };
    const v = found.voucher;
    v.state = 'void';
    v.meta.tags = [...new Set([...(v.meta.tags || []), 'void'])];
    if (reason) v.meta.voidReason = reason;
    await this.store.put(v);
    this.#emit('voided', { voucher: v });
    return { ok: true, voucher: v };
  }

  /** โหลดข้อมูลตัวอย่าง/ข้อมูลจริงเข้าที่เก็บ */
  async load(list, { replace = false } = {}) {
    if (replace) await this.store.clear();
    const out = [];
    for (const raw of list) {
      const v = createVoucher(raw);
      await this.store.put(v);
      out.push(v);
    }
    this.#emit('loaded', { vouchers: out });
    return out;
  }

  /** คูปองของลูกค้าคนหนึ่ง (ผูกไอดี หรือคูปองสาธารณะที่กลุ่มตรง) */
  async walletOf(customerId, segments = ['public']) {
    const all = await this.all();
    return all.filter((v) => {
      if (v.audience.customerId) return v.audience.customerId === customerId;
      const segs = v.audience.segments || ['public'];
      return segs.includes('public') || segs.some((s) => segments.includes(s));
    });
  }
}

/** แปลงสถานะเป็นคีย์เหตุผล (ใช้กับ strings.th.js reject.*) */
function statusToReason(status) {
  switch (status) {
    case 'expired': return 'expired';
    case 'redeemed': return 'already_redeemed';
    case 'void': return 'voided';
    case 'scheduled': return 'not_started';
    case 'reserved': return 'reserved';
    default: return 'voided';
  }
}

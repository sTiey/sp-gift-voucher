/**
 * schema.js — รูปร่างข้อมูลของ "คูปอง 1 ใบ" และ "แคมเปญ 1 ชุด"
 * ---------------------------------------------------------------------------
 * ที่นี่คือ "สัญญากลาง" ของทั้งระบบ  ฝั่งหน้าเว็บ / ฝั่งหลังบ้าน / ไฟล์ JSON
 * ต้องพูดภาษาเดียวกันตามนี้  ถ้าจะเพิ่ม field ใหม่ ให้เพิ่มที่นี่ก่อนเสมอ
 *
 * หลักที่ยึด:
 *   1. field ทุกตัวมีค่าเริ่มต้น — สร้างคูปองด้วยข้อมูลแค่ 2-3 ตัวก็ได้ของครบ
 *   2. "สถานะที่เก็บ" (state) กับ "สถานะที่เห็น" (status) แยกกัน
 *      state เก็บสิ่งที่มนุษย์ทำ (ออก/จอง/ตัดสิทธิ์/ยกเลิก)
 *      status คำนวณสด ๆ จาก state + วันที่ + โควตา  →  ดู lifecycle.js
 *   3. หน้าตาอยู่ใน design.*  ตรรกะอยู่ใน conditions.*  ห้ามปนกัน
 */

/** ชนิดสิทธิ์ที่ระบบรองรับ */
export const KINDS = /** @type {const} */ ([
  'percent', // ลดเป็นเปอร์เซ็นต์      value = 15  → ลด 15%
  'amount', // ลดเป็นจำนวนเงิน        value = 500 → ลด 500 บาท
  'fixed_price', // ขายในราคาพิเศษ    value = 1990 → เหลือ 1,990 บาท
  'free_item', // แถมของ              value = จำนวนชิ้น
  'free_shipping', // ส่งฟรี           value ไม่ใช้
]);

/** กลุ่มลูกค้ามาตรฐาน — เพิ่มกลุ่มใหม่ได้ แค่เติมคำใน strings.th.js segment.* */
export const SEGMENTS = /** @type {const} */ ([
  'public',
  'partner',
  'vip',
  'returning',
  'new',
  'staff',
]);

/** สถานะที่ "เก็บ" ลงฐานข้อมูล (สิ่งที่คนกระทำ) */
export const STATES = /** @type {const} */ ([
  'draft', // ยังไม่ปล่อยออกไป
  'issued', // ออกให้ลูกค้าแล้ว
  'reserved', // กำลังใช้อยู่ (ล็อกกันใช้ซ้ำระหว่างจ่ายเงิน)
  'redeemed', // ตัดสิทธิ์แล้ว
  'void', // ยกเลิกโดยแอดมิน
]);

export const SKINS = /** @type {const} */ (['steel', 'ink', 'voltage']);
export const LAYOUTS = /** @type {const} */ (['slab', 'strip', 'mini']);

/** ค่าเริ่มต้นของคูปอง 1 ใบ — เป็นแหล่งความจริงว่ามี field อะไรบ้าง */
export function voucherDefaults() {
  return {
    id: '',
    code: '',
    campaignId: null,

    /* --- สิทธิ์ที่ได้ --- */
    kind: 'percent',
    value: 0,
    currency: 'THB',

    /* --- ข้อความที่พิมพ์บนใบ --- */
    title: '',
    subtitle: '',
    note: '',
    terms: [],
    brand: { name: '', logoUrl: null, tagline: '' },

    /* --- เงื่อนไขการใช้ --- */
    conditions: {
      minSpend: null, // ยอดขั้นต่ำ (บาท)
      maxDiscount: null, // เพดานส่วนลด ใช้กับ percent
      channels: [], // ว่าง = ทุกช่องทาง  เช่น ['web','app','store']
      branches: [], // ว่าง = ทุกสาขา
      productScope: { include: [], exclude: [], categories: [] },
      combinable: false, // ใช้ร่วมกับส่วนลดอื่นได้ไหม
    },

    /* --- ใครใช้ได้ --- */
    audience: {
      segments: ['public'],
      customerId: null, // ผูกกับลูกค้าคนเดียว (null = ใครถือก็ใช้ได้)
      customerName: null,
    },

    /* --- อายุ + โควตา --- */
    validFrom: null, // ISO string หรือ null = ใช้ได้ทันที
    validUntil: null, // ISO string หรือ null = ไม่มีวันหมด
    limits: { perPerson: 1, total: null },
    usage: { used: 0, byCustomer: {} },

    /* --- สถานะ --- */
    state: 'issued',
    reservedUntil: null,
    redeemedAt: null,
    redeemedBy: null, // ไอดีพนักงาน/สาขาที่ตัดสิทธิ์

    /* --- หน้าตา (ไม่กระทบตรรกะเลย) --- */
    design: {
      skin: 'steel',
      layout: 'slab',
      accent: null, // ทับสีเน้นเฉพาะใบนี้ เช่น '#1e88e5'
      badge: null, // คำบนป้ายมุม เช่น 'LIMITED'
      artUrl: null, // ภาพประกอบครึ่งบน
    },

    /* --- ข้อมูลกำกับ --- */
    meta: { issuedAt: null, issuedBy: null, source: 'manual', tags: [] },
  };
}

/** รวม object ซ้อนชั้นแบบไม่ทำลายค่าเดิม (ลึกเท่าที่ schema ใช้จริง) */
function deepMerge(base, patch) {
  if (!patch) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) {
      out[k] = deepMerge(cur, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * สร้างคูปองที่ "ครบทุก field" จากข้อมูลบางส่วน
 * ใช้ทุกครั้งที่รับข้อมูลจากภายนอก (JSON / API / ฟอร์ม)
 */
export function createVoucher(partial = {}) {
  const v = deepMerge(voucherDefaults(), partial);
  if (!v.meta.issuedAt) v.meta.issuedAt = new Date().toISOString();
  if (!Array.isArray(v.audience.segments) || v.audience.segments.length === 0) {
    v.audience.segments = ['public'];
  }
  return v;
}

/**
 * ตรวจว่าโครงถูกไหม — คืนรายการปัญหา (ว่าง = ผ่าน)
 * ใช้ตอนโหลด JSON เข้าระบบ หรือก่อนบันทึกจากหน้าแอดมิน
 */
export function validateVoucher(v) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  need(typeof v.code === 'string' && v.code.length > 0, 'ไม่มีรหัสคูปอง (code)');
  need(KINDS.includes(v.kind), `kind ไม่รู้จัก: ${v.kind}`);
  need(STATES.includes(v.state), `state ไม่รู้จัก: ${v.state}`);
  need(typeof v.value === 'number' && !Number.isNaN(v.value), 'value ต้องเป็นตัวเลข');

  if (v.kind === 'percent') {
    need(v.value > 0 && v.value <= 100, 'ส่วนลด % ต้องอยู่ระหว่าง 1-100');
  }
  if (v.kind === 'amount' || v.kind === 'fixed_price') {
    need(v.value > 0, 'มูลค่าต้องมากกว่า 0');
  }
  if (v.validFrom && v.validUntil) {
    need(
      new Date(v.validFrom).getTime() <= new Date(v.validUntil).getTime(),
      'วันเริ่มต้องมาก่อนวันหมดอายุ'
    );
  }
  need(
    v.audience.segments.every((s) => SEGMENTS.includes(s)),
    'มีกลุ่มลูกค้าที่ระบบไม่รู้จักใน audience.segments'
  );
  need(SKINS.includes(v.design.skin), `design.skin ไม่รู้จัก: ${v.design.skin}`);
  need(LAYOUTS.includes(v.design.layout), `design.layout ไม่รู้จัก: ${v.design.layout}`);
  if (v.limits.total != null) {
    need(v.limits.total >= 0, 'limits.total ต้องไม่ติดลบ');
  }
  return problems;
}

/** ค่าเริ่มต้นของ "แคมเปญ" — แม่พิมพ์สำหรับปั๊มคูปองหลายใบพร้อมกัน */
export function campaignDefaults() {
  return {
    id: '',
    name: '',
    description: '',
    codePrefix: 'GV',
    quantity: 1,
    /* ทุก field ของคูปองที่อยากให้เหมือนกันทั้งชุด ใส่ใน template */
    template: {},
    createdAt: null,
  };
}

export function createCampaign(partial = {}) {
  const c = deepMerge(campaignDefaults(), partial);
  if (!c.createdAt) c.createdAt = new Date().toISOString();
  return c;
}

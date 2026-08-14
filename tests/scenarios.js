/**
 * scenarios.js — "สถานการณ์จริง" ที่ระบบต้องรับมือได้ทุกอัน
 * ---------------------------------------------------------------------------
 * ไฟล์นี้คือ **แหล่งความจริงเดียว** ของการทดสอบ ใช้ได้ 2 ทาง:
 *
 *   1) เครื่องรันเอง   →  node tools/selftest.mjs
 *   2) คนกดดูเอง      →  เปิด /demo/scenarios.html แล้วกดทดสอบทีละอัน
 *
 * ทั้งสองทางใช้ตัวรันตัวเดียวกัน ผลจึงตรงกันเสมอ
 * (ถ้าแยกกันเขียน วันหนึ่งมันจะไม่ตรงกันแล้วเชื่ออันไหนไม่ได้เลย)
 *
 * เขียนสถานการณ์ใหม่ยังไง — ก๊อปอันที่ใกล้เคียงแล้วแก้ 4 ช่อง:
 *   title   ชื่อสั้น ๆ ที่คนอ่านรู้เรื่อง
 *   story   เล่าเป็นเรื่องว่าเกิดอะไรขึ้นหน้าร้าน
 *   steps   ทำอะไรบ้าง + คาดว่าจะได้อะไร
 *   why     ทำไมต้องเทสต์ข้อนี้ (พังแล้วเสียหายยังไง)
 */

import {
  VoucherService, MemoryStore, createVoucher,
  liveCode, verifyLiveCode, LIVE_CODE_PERIOD,
  parseCode, checkChar, encodeQr, bestVoucher, deriveStatus,
} from '../src/index.js';

const DAY = 86400000;
const iso = (days) => new Date(Date.now() + days * DAY).toISOString();

/**
 * รหัสสำหรับทดสอบ — **คำนวณตัวตรวจทานให้เอง** ห้ามพิมพ์รหัสเต็มด้วยมือ
 * ⚠️ เคยพลาดมาแล้ว 2 รอบ (ทั้งในไฟล์ข้อมูลตัวอย่างและในไฟล์นี้):
 *    พิมพ์รหัสเองแล้วตัวสุดท้ายไม่ตรงสูตร → ทุกสถานการณ์ตอบ "รหัสไม่ถูกต้อง"
 *    เหมือนกันหมด ทำให้หลงคิดว่าตรรกะพัง ทั้งที่พังแค่ข้อมูลทดสอบ
 */
const mk = (prefix, seven) => {
  const body = seven + checkChar(seven);
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`;
};

const C = {
  a: mk('TEST', '2345678'),
  b: mk('SPE', '7K4M92X'),
  c: mk('VIP', '3H8N5TQ'),
  d: mk('SHIP', '4C7B8XJ'),
  e: mk('BACK', '9RD26MW'),
  digits: mk('GV', '0123456'),   // มีเลข 0 กับ 1 เพื่อทดสอบการซ่อม O/I
};

/** คูปองต้นแบบ — ทุกสถานการณ์แก้เฉพาะช่องที่เกี่ยวข้อง */
const base = (over = {}) => ({
  code: C.a,
  kind: 'percent',
  value: 15,
  title: 'คูปองทดสอบ',
  brand: { name: 'SP Empire' },
  ...over,
});

/* ════════════════════════════════════════════════════════════════════════
   รายการสถานการณ์
   ════════════════════════════════════════════════════════════════════════ */

export const SCENARIOS = [

  /* ─────────────── กลุ่ม 1 · ชนิดสิทธิ์ทั้ง 5 แบบ ─────────────── */
  {
    id: 'kind-percent',
    group: 'ชนิดสิทธิ์',
    title: 'ลดเป็นเปอร์เซ็นต์',
    story: 'ลูกค้าซื้อของ 10,000 บาท ใช้คูปองลด 15%',
    why: 'ชนิดที่ใช้บ่อยที่สุด ถ้าคิดผิดคือคิดเงินผิดทุกบิล',
    vouchers: [base({ kind: 'percent', value: 15 })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 1500, payable: 8500 } }],
  },
  {
    id: 'kind-amount',
    group: 'ชนิดสิทธิ์',
    title: 'ลดเป็นจำนวนเงิน',
    story: 'บัตรกำนัล 1,500 บาท ใช้กับบิล 10,000',
    why: 'บัตรกำนัลคือเงินจริงที่บริษัทจ่ายไปแล้ว ต้องหักตรงเป๊ะ',
    vouchers: [base({ kind: 'amount', value: 1500 })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 1500, payable: 8500 } }],
  },
  {
    id: 'kind-fixed-price',
    group: 'ชนิดสิทธิ์',
    title: 'ขายในราคาพิเศษ',
    story: 'ราวระเบียงปกติ 9,900 จัดโปรเหลือ 7,900',
    why: 'ประกาศเป็น "ราคา" ไม่ใช่ "ส่วนลด" ระบบต้องแปลงกลับให้ถูก',
    vouchers: [base({ kind: 'fixed_price', value: 7900 })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 9900 }, expect: { ok: true, discount: 2000, payable: 7900 } }],
  },
  {
    id: 'kind-free-item',
    group: 'ชนิดสิทธิ์',
    title: 'ของแถม',
    story: 'ซื้อราวบันไดแถมชุดน็อตสำรอง 1 ชุด',
    why: 'ของแถมไม่ลดเงิน แต่ต้องมีธงบอกให้ระบบคลังตัดของ',
    vouchers: [base({ kind: 'free_item', value: 1 })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 0, freeItems: 1 } }],
  },
  {
    id: 'kind-free-shipping',
    group: 'ชนิดสิทธิ์',
    title: 'ส่งฟรี',
    story: 'สั่งครบ 5,000 ส่งฟรีทั่วประเทศ',
    why: 'ต้องไม่ไปหักยอดสินค้า แต่ต้องบอกระบบขนส่งว่าไม่เก็บค่าส่ง',
    vouchers: [base({ kind: 'free_shipping', conditions: { minSpend: 5000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 0, freeShipping: true } }],
  },

  /* ─────────────── กลุ่ม 2 · เพดานและขั้นต่ำ ─────────────── */
  {
    id: 'cap-hit',
    group: 'เพดาน/ขั้นต่ำ',
    title: 'ลด 15% แต่ชนเพดาน 2,000',
    story: 'พาร์ทเนอร์สั่งงาน 24,000 บาท คูปองลด 15% (= 3,600) แต่ตั้งเพดานไว้ 2,000',
    why: '⚠️ ลืมใส่เพดานคือสิ่งที่เจ็บที่สุด — ออร์เดอร์ 800,000 จะลดไป 120,000',
    vouchers: [base({ kind: 'percent', value: 15, conditions: { maxDiscount: 2000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 24000 }, expect: { ok: true, discount: 2000, payable: 22000 } }],
  },
  {
    id: 'cap-not-hit',
    group: 'เพดาน/ขั้นต่ำ',
    title: 'มีเพดานแต่ยังไม่ชน',
    story: 'บิล 10,000 ลด 15% = 1,500 ซึ่งยังไม่ถึงเพดาน 2,000',
    why: 'กันเคสที่เพดานไปกดส่วนลดทั้งที่ยังไม่ควรกด',
    vouchers: [base({ kind: 'percent', value: 15, conditions: { maxDiscount: 2000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 1500 } }],
  },
  {
    id: 'min-spend-fail',
    group: 'เพดาน/ขั้นต่ำ',
    title: 'ยอดไม่ถึงขั้นต่ำ',
    story: 'คูปองบังคับซื้อครบ 10,000 แต่ลูกค้าซื้อแค่ 8,000',
    why: 'ถ้าปล่อยผ่าน = แจกส่วนลดฟรีให้บิลเล็ก ผิดเป้าหมายโปรโมชัน',
    vouchers: [base({ conditions: { minSpend: 10000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 8000 }, expect: { ok: false, reason: 'min_spend' } }],
  },
  {
    id: 'min-spend-exact',
    group: 'เพดาน/ขั้นต่ำ',
    title: 'ยอดเท่าขั้นต่ำพอดี',
    story: 'ขั้นต่ำ 10,000 ลูกค้าซื้อ 10,000 พอดีเป๊ะ',
    why: 'เส้นแบ่งพอดีคือจุดที่โค้ดชอบพลาด (> กับ >= สลับกัน)',
    vouchers: [base({ conditions: { minSpend: 10000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, discount: 1500 } }],
  },
  {
    id: 'discount-over-total',
    group: 'เพดาน/ขั้นต่ำ',
    title: 'บัตรกำนัลใหญ่กว่าบิล',
    story: 'บัตรกำนัล 1,500 แต่ลูกค้าซื้อของแค่ 900 บาท',
    why: 'ห้ามลดจนยอดติดลบ ไม่งั้นกลายเป็นร้านต้องจ่ายเงินให้ลูกค้า',
    vouchers: [base({ kind: 'amount', value: 1500 })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 900 }, expect: { ok: true, discount: 900, payable: 0 } }],
  },

  /* ─────────────── กลุ่ม 3 · เวลา ─────────────── */
  {
    id: 'time-not-started',
    group: 'เวลา',
    title: 'ยังไม่ถึงวันเริ่มใช้',
    story: 'โปรเปิดตัวคอลเลกชันใหม่ เริ่มเดือนหน้า ลูกค้าเอามาใช้ก่อน',
    why: 'ลูกค้าเห็นคูปองในกระเป๋าแล้วแต่ยังใช้ไม่ได้ ต้องบอกให้ชัด ไม่ใช่บอกว่าคูปองเสีย',
    vouchers: [base({ validFrom: iso(7), validUntil: iso(37) })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: false, reason: 'not_started', status: 'scheduled' } }],
  },
  {
    id: 'time-expired',
    group: 'เวลา',
    title: 'หมดอายุไปแล้ว',
    story: 'โปรกลางปีหมดไปเมื่อวาน ลูกค้าเพิ่งมาใช้วันนี้',
    why: 'ระบบต้องรู้เองจากวันที่ ไม่ต้องมีใครไปนั่งปิดคูปองทีละใบ',
    vouchers: [base({ validUntil: iso(-1) })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: false, reason: 'expired', status: 'expired' } }],
  },
  {
    id: 'time-last-day',
    group: 'เวลา',
    title: 'วันสุดท้ายยังใช้ได้',
    story: 'คูปองหมดอายุสิ้นวันนี้ ลูกค้ามาใช้ตอนบ่าย',
    why: 'ตัดตอนเที่ยงคืนไม่ใช่ตอนต้นวัน — พลาดตรงนี้ลูกค้าโวยแน่',
    vouchers: [base({ validUntil: iso(0.4) })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true } }],
  },
  {
    id: 'time-no-expiry',
    group: 'เวลา',
    title: 'ไม่มีวันหมดอายุ',
    story: 'คูปองส่งฟรีที่ให้ใช้ได้ตลอด',
    why: 'ต้องไม่ไปตีความว่า "ไม่มีวันหมด" = "หมดแล้ว"',
    vouchers: [base({ validUntil: null })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, status: 'active' } }],
  },

  /* ─────────────── กลุ่ม 4 · ใครใช้ได้ ─────────────── */
  {
    id: 'seg-partner-ok',
    group: 'กลุ่มลูกค้า',
    title: 'คูปองพาร์ทเนอร์ · พาร์ทเนอร์ใช้',
    story: 'ร้านตัวแทนที่ลงทะเบียนไว้เอาคูปองพาร์ทเนอร์มาใช้',
    why: 'โปรเฉพาะกลุ่มคือเหตุผลหลักที่ทำระบบนี้',
    vouchers: [base({ audience: { segments: ['partner'] } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, segments: ['partner'] }, expect: { ok: true } }],
  },
  {
    id: 'seg-partner-blocked',
    group: 'กลุ่มลูกค้า',
    title: 'คูปองพาร์ทเนอร์ · คนทั่วไปใช้',
    story: 'ลูกค้าทั่วไปได้รหัสพาร์ทเนอร์มาจากที่ไหนไม่รู้ แล้วเอามาใช้',
    why: 'ราคาพาร์ทเนอร์รั่วไปถึงลูกค้าทั่วไป = พังทั้งโครงสร้างราคา',
    vouchers: [base({ audience: { segments: ['partner'] } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, segments: ['public'] }, expect: { ok: false, reason: 'segment' } }],
  },
  {
    id: 'seg-multi',
    group: 'กลุ่มลูกค้า',
    title: 'คูปองเปิดให้หลายกลุ่ม',
    story: 'โปรสำหรับลูกค้าประจำและลูกค้าเก่า ลูกค้าเก่ามาใช้',
    why: 'เข้ากลุ่มใดกลุ่มหนึ่งก็ต้องผ่าน ไม่ใช่ต้องเข้าทุกกลุ่ม',
    vouchers: [base({ audience: { segments: ['vip', 'returning'] } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, segments: ['returning'] }, expect: { ok: true } }],
  },
  {
    id: 'seg-bound-customer',
    group: 'กลุ่มลูกค้า',
    title: 'คูปองผูกกับลูกค้าคนเดียว · คนอื่นใช้',
    story: 'บัตรกำนัลที่ออกให้คุณสมชายโดยเฉพาะ แต่คนอื่นเอารหัสมาใช้',
    why: 'บัตรกำนัลมูลค่าสูงต้องผูกคน ไม่งั้นใครเจอรหัสก็เอาไปใช้ได้',
    vouchers: [base({ audience: { customerId: 'cus_1029' } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, customerId: 'cus_9999' }, expect: { ok: false, reason: 'wrong_customer' } }],
  },
  {
    id: 'seg-bound-owner',
    group: 'กลุ่มลูกค้า',
    title: 'คูปองผูกคน · เจ้าของใช้เอง',
    story: 'คุณสมชายเอาบัตรกำนัลของตัวเองมาใช้',
    why: 'กันเคสที่ล็อกแน่นเกินจนเจ้าของก็ใช้ไม่ได้',
    vouchers: [base({ audience: { customerId: 'cus_1029' } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, customerId: 'cus_1029' }, expect: { ok: true } }],
  },

  /* ─────────────── กลุ่ม 5 · โควตา ─────────────── */
  {
    id: 'quota-single-use',
    group: 'โควตา',
    title: 'ใบเดียวจบ ใช้ซ้ำไม่ได้',
    story: 'ลูกค้าใช้คูปองไปแล้ว วันรุ่งขึ้นเอารหัสเดิมมาใช้อีก',
    why: 'จุดตายของระบบคูปอง — ใช้ซ้ำได้เมื่อไหร่คือเสียเงินทันที',
    vouchers: [base({ kind: 'amount', value: 300 })],
    steps: [
      { do: 'redeem', code: C.a, context: { orderTotal: 5000, customerId: 'cus_1' }, expect: { ok: true, discount: 300 } },
      { do: 'check', code: C.a, context: { orderTotal: 5000, customerId: 'cus_1' }, expect: { ok: false, reason: 'already_redeemed' } },
    ],
  },
  {
    id: 'quota-limited-pool',
    group: 'โควตา',
    title: 'แจก 2 สิทธิ์ ใครมาก่อนได้ก่อน',
    story: 'โปรจำกัด 2 สิทธิ์ · คนแรกใช้ คนที่สองใช้ คนที่สามมาไม่ทัน',
    why: 'โปรจำนวนจำกัดต้องหยุดตรงจำนวนที่ประกาศไว้เป๊ะ',
    vouchers: [base({ kind: 'amount', value: 100, limits: { perPerson: 5, total: 2 } })],
    steps: [
      { do: 'redeem', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'b' }, expect: { ok: true } },
      { do: 'redeem', code: C.a, context: { orderTotal: 1000, customerId: 'b' }, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'c' }, expect: { ok: false, reason: 'already_redeemed' } },
    ],
  },
  {
    id: 'quota-public-code',
    group: 'โควตา',
    title: 'โค้ดสาธารณะ ใช้ได้ไม่จำกัดคน',
    story: 'โค้ด SONGKRAN10 ประกาศหน้าเว็บ ใครก็ใช้ได้ แต่คนละ 1 ครั้ง',
    why: '⚠️ เคยพลาด: โค้ดแบบนี้เคยถูกปิดทิ้งหลังคนแรกใช้',
    vouchers: [base({ kind: 'percent', value: 10, limits: { perPerson: 1, total: null } })],
    steps: [
      { do: 'redeem', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'b' }, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: false, reason: 'limit_per_person' } },
    ],
  },
  {
    id: 'quota-per-person-2',
    group: 'โควตา',
    title: 'คนละ 2 ครั้ง',
    story: 'คูปองส่งฟรีที่ให้ใช้ได้คนละ 2 ครั้ง',
    why: 'ต้องนับแยกรายคน ไม่ใช่นับรวม',
    vouchers: [base({ kind: 'free_shipping', limits: { perPerson: 2, total: null } })],
    steps: [
      { do: 'redeem', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: true } },
      { do: 'redeem', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'a' }, expect: { ok: false, reason: 'limit_per_person' } },
      { do: 'check', code: C.a, context: { orderTotal: 1000, customerId: 'b' }, expect: { ok: true } },
    ],
  },

  /* ─────────────── กลุ่ม 6 · ช่องทางและสาขา ─────────────── */
  {
    id: 'channel-store-only',
    group: 'ช่องทาง/สาขา',
    title: 'คูปองใช้ได้เฉพาะหน้าร้าน',
    story: 'โปรที่ต้องการดึงคนมาที่โชว์รูม แต่ลูกค้าพยายามใช้ตอนสั่งออนไลน์',
    why: 'โปรดึงคนเข้าร้านต้องกันการใช้ทางเว็บ ไม่งั้นเสียวัตถุประสงค์',
    vouchers: [base({ conditions: { channels: ['store'] } })],
    steps: [
      { do: 'check', code: C.a, context: { orderTotal: 10000, channel: 'web' }, expect: { ok: false, reason: 'channel' } },
      { do: 'check', code: C.a, context: { orderTotal: 10000, channel: 'store' }, expect: { ok: true } },
    ],
  },
  {
    id: 'branch-limited',
    group: 'ช่องทาง/สาขา',
    title: 'คูปองใช้ได้เฉพาะบางสาขา',
    story: 'โปรเปิดสาขาใหม่ ใช้ได้แค่สาขานั้น',
    why: 'งบโปรมาจากสาขาเดียว สาขาอื่นไม่ควรโดนหักยอด',
    vouchers: [base({ conditions: { branches: ['สาขาบางนา'] } })],
    steps: [
      { do: 'check', code: C.a, context: { orderTotal: 10000, branch: 'สาขารังสิต' }, expect: { ok: false, reason: 'branch' } },
      { do: 'check', code: C.a, context: { orderTotal: 10000, branch: 'สาขาบางนา' }, expect: { ok: true } },
    ],
  },

  /* ─────────────── กลุ่ม 7 · จำกัดเฉพาะสินค้า ─────────────── */
  {
    id: 'scope-category',
    group: 'สินค้าเฉพาะ',
    title: 'ลดเฉพาะหมวดราวบันได',
    story: 'ตะกร้ามีราวบันได 4,000 + ราวระเบียง 6,000 คูปองลด 10% เฉพาะราวบันได',
    why: 'ต้องคิดจากยอดเฉพาะสินค้าที่เข้าเงื่อนไข (400) ไม่ใช่ยอดทั้งตะกร้า (1,000)',
    vouchers: [base({ kind: 'percent', value: 10, conditions: { productScope: { categories: ['stair'] } } })],
    steps: [{
      do: 'check', code: C.a,
      context: {
        orderTotal: 10000,
        items: [
          { sku: 'S1', category: 'stair', price: 2000, qty: 2 },
          { sku: 'B1', category: 'balcony', price: 6000, qty: 1 },
        ],
      },
      expect: { ok: true, discount: 400, payable: 9600 },
    }],
  },
  {
    id: 'scope-no-match',
    group: 'สินค้าเฉพาะ',
    title: 'ในตะกร้าไม่มีสินค้าที่เข้าเงื่อนไข',
    story: 'คูปองลดเฉพาะราวบันได แต่ตะกร้ามีแต่ราวระเบียง',
    why: 'ต้องบอกเหตุผลให้ตรงว่า "สินค้าไม่เข้าเงื่อนไข" ไม่ใช่ "ยอดไม่ถึง"',
    vouchers: [base({ kind: 'percent', value: 10, conditions: { productScope: { categories: ['stair'] } } })],
    steps: [{
      do: 'check', code: C.a,
      context: { orderTotal: 6000, items: [{ sku: 'B1', category: 'balcony', price: 6000, qty: 1 }] },
      expect: { ok: false, reason: 'product_scope' },
    }],
  },
  {
    id: 'scope-exclude',
    group: 'สินค้าเฉพาะ',
    title: 'ยกเว้นสินค้าบางตัว',
    story: 'ลด 10% ทุกอย่าง ยกเว้นสินค้าลดราคาอยู่แล้ว (SALE-1)',
    why: 'สินค้าที่กำไรบางอยู่แล้วต้องกันไว้ ไม่งั้นขายยิ่งขายยิ่งขาดทุน',
    vouchers: [base({ kind: 'percent', value: 10, conditions: { productScope: { categories: ['stair'], exclude: ['SALE-1'] } } })],
    steps: [{
      do: 'check', code: C.a,
      context: {
        orderTotal: 9000,
        items: [
          { sku: 'S1', category: 'stair', price: 4000, qty: 1 },
          { sku: 'SALE-1', category: 'stair', price: 5000, qty: 1 },
        ],
      },
      expect: { ok: true, discount: 400 },
    }],
  },

  /* ─────────────── กลุ่ม 8 · สถานะของใบ ─────────────── */
  {
    id: 'state-void',
    group: 'สถานะ',
    title: 'คูปองถูกยกเลิกโดยแอดมิน',
    story: 'ออกคูปองผิดเงื่อนไข แอดมินยกเลิกทิ้ง แล้วลูกค้าเอามาใช้',
    why: 'ต้องยกเลิกได้ทันทีตอนออกผิด ไม่ต้องรอหมดอายุ',
    vouchers: [base()],
    steps: [
      { do: 'void', code: C.a },
      { do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: false, reason: 'voided', status: 'void' } },
    ],
  },
  {
    id: 'state-reserve-then-redeem',
    group: 'สถานะ',
    title: 'จองไว้ตอนจ่ายเงิน แล้วจ่ายสำเร็จ',
    story: 'ลูกค้ากดใช้คูปองในตะกร้า ระบบล็อกไว้ 5 นาที แล้วจ่ายเงินสำเร็จ',
    why: 'กันคูปองถูกใช้จากอีกเครื่องระหว่างที่ยังจ่ายเงินไม่เสร็จ',
    vouchers: [base({ kind: 'amount', value: 300 })],
    steps: [
      { do: 'reserve', code: C.a, expect: { ok: true } },
      { do: 'check', code: C.a, context: { orderTotal: 5000 }, expect: { ok: false, reason: 'reserved' } },
      { do: 'redeem', code: C.a, context: { orderTotal: 5000 }, expect: { ok: true, discount: 300 } },
    ],
  },
  {
    id: 'state-reserve-then-cancel',
    group: 'สถานะ',
    title: 'จองไว้แล้วลูกค้ายกเลิก',
    story: 'ลูกค้ากดใช้คูปองแล้วเปลี่ยนใจ กดยกเลิกตอนจ่ายเงิน',
    why: 'ยกเลิกแล้วคูปองต้องกลับมาใช้ได้ ไม่ใช่ค้างตายไปเลย',
    vouchers: [base()],
    steps: [
      { do: 'reserve', code: C.a, expect: { ok: true } },
      { do: 'release', code: C.a },
      { do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, status: 'active' } },
    ],
  },
  {
    id: 'state-reserve-expired',
    group: 'สถานะ',
    title: 'จองค้างไว้แล้วปิดหน้าเว็บหนี',
    story: 'ลูกค้ากดใช้คูปองแล้วปิดหน้าเว็บไปเลย ไม่ได้จ่ายและไม่ได้ยกเลิก',
    why: 'ถ้าไม่ปลดล็อกเอง คูปองจะค้างตายและต้องมีคนไปแก้มือทีละใบ',
    vouchers: [base({ state: 'reserved', reservedUntil: iso(-0.01) })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000 }, expect: { ok: true, status: 'active' } }],
  },
  {
    id: 'state-combinable',
    group: 'สถานะ',
    title: 'ใช้ร่วมกับส่วนลดอื่นไม่ได้',
    story: 'ลูกค้ามีส่วนลดสมาชิกอยู่แล้ว แล้วจะเอาคูปองมาใช้ทับ',
    why: 'ลดซ้อนลดโดยไม่ได้ตั้งใจ = ขายต่ำกว่าทุน',
    vouchers: [base({ conditions: { combinable: false } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 10000, hasOtherDiscount: true }, expect: { ok: false, reason: 'not_combinable' } }],
  },

  /* ─────────────── กลุ่ม 9 · รหัสคูปอง ─────────────── */
  {
    id: 'code-typo',
    group: 'รหัส',
    title: 'พนักงานพิมพ์ผิด 1 ตัว',
    story: 'ลูกค้าอ่านรหัสให้ฟัง พนักงานพิมพ์ตัวสุดท้ายผิด',
    why: 'ต้องบอกว่า "พิมพ์ผิด" ไม่ใช่ "ไม่พบคูปอง" — คนละเรื่องกันในสายตาพนักงาน',
    vouchers: [base()],
    steps: [{ do: 'check', code: `${C.a.slice(0, -1)}${C.a.endsWith('Z') ? 'Y' : 'Z'}`,
              context: { orderTotal: 10000 }, expect: { ok: false, reason: 'bad_code' } }],
  },
  {
    id: 'code-no-dash',
    group: 'รหัส',
    title: 'พิมพ์ติดกันไม่ใส่ขีด',
    story: 'พนักงานรีบ พิมพ์ ship4c7b8xjr รวดเดียวไม่ใส่ขีด',
    why: '⚠️ เคยพลาด: ตัว I ใน SHIP โดนซ่อมเป็นเลข 1 แล้วหาคูปองไม่เจอ',
    vouchers: [base({ code: C.d })],
    steps: [{ do: 'check', code: C.d.replace(/-/g, '').toLowerCase(), context: { orderTotal: 10000 }, expect: { ok: true } }],
  },
  {
    id: 'code-lowercase',
    group: 'รหัส',
    title: 'พิมพ์ตัวเล็กทั้งหมด',
    story: 'ลูกค้าก๊อปรหัสจากอีเมลแล้วมันกลายเป็นตัวเล็ก',
    why: 'อย่าให้ผู้ใช้ต้องมานั่งกด Shift',
    vouchers: [base({ code: C.b })],
    steps: [{ do: 'check', code: C.b.toLowerCase(), context: { orderTotal: 10000 }, expect: { ok: true } }],
  },
  {
    id: 'code-confusables',
    group: 'รหัส',
    title: 'พิมพ์ตัวที่คนมักสับสน',
    story: 'รหัสจริงมีเลข 0 กับ 1 แต่ลูกค้าพิมพ์ตัว O กับ I มาแทน',
    why: 'อ่านรหัสทางโทรศัพท์แล้วสับสน O/0 และ I/1 เป็นเรื่องปกติมาก',
    vouchers: [base({ code: C.digits })],
    steps: [{ do: 'parse', code: C.digits.toLowerCase().replace('0', 'O').replace('1', 'I'),
              expect: { ok: true, code: C.digits } }],
  },
  {
    id: 'code-not-found',
    group: 'รหัส',
    title: 'รหัสถูกแบบแต่ไม่มีในระบบ',
    story: 'มีคนลองสุ่มรหัสที่รูปแบบถูกต้องมายิง',
    why: 'ต้องแยกให้ออกระหว่าง "พิมพ์ผิด" กับ "ไม่มีจริง"',
    vouchers: [base()],
    steps: [{ do: 'check', code: C.c, context: { orderTotal: 10000 }, expect: { ok: false, reason: 'not_found' } }],
  },

  /* ─────────────── กลุ่ม 10 · รหัสยืนยันสด ─────────────── */
  {
    id: 'live-match',
    group: 'รหัสยืนยันสด',
    title: 'ลูกค้าอ่านรหัสสด พนักงานกรอกตรง',
    story: 'ลูกค้าอ่านเลข 4 หลักบนจอให้ฟัง พนักงานพิมพ์ตาม',
    why: 'ท่ายืนยันว่าลูกค้าถือคูปองจริง ไม่ใช่ภาพหน้าจอ',
    vouchers: [base()],
    steps: [{ do: 'liveCode', voucherId: 'v_test', offsetMs: 0, expect: { verifies: true } }],
  },
  {
    id: 'live-late',
    group: 'รหัสยืนยันสด',
    title: 'อ่านเลขไม่ทัน ข้ามรอบพอดี',
    story: 'ลูกค้าอ่านเลขช้า พอพนักงานพิมพ์เสร็จ เลขเปลี่ยนรอบไปแล้ว',
    why: 'ถ้าเข้มเกินไปจะใช้ไม่ได้จริงหน้าเคาน์เตอร์ ต้องยอมรับรอบก่อนหน้า 1 รอบ',
    vouchers: [base()],
    steps: [{ do: 'liveCode', voucherId: 'v_test', offsetMs: LIVE_CODE_PERIOD, expect: { verifies: true } }],
  },
  {
    id: 'live-screenshot',
    group: 'รหัสยืนยันสด',
    title: 'ใช้ภาพหน้าจอเก่า',
    story: 'ลูกค้าแคปหน้าจอส่งให้เพื่อน เพื่อนเอาภาพมาแสดงที่ร้านทีหลัง',
    why: '🎯 นี่คือเหตุผลทั้งหมดที่ต้องมีรหัสสด',
    vouchers: [base()],
    steps: [{ do: 'liveCode', voucherId: 'v_test', offsetMs: LIVE_CODE_PERIOD * 3, expect: { verifies: false } }],
  },

  /* ─────────────── กลุ่ม 11 · เลือกใบที่คุ้มที่สุด ─────────────── */
  {
    id: 'best-pick',
    group: 'เลือกให้อัตโนมัติ',
    title: 'ลูกค้ามีคูปอง 3 ใบ ระบบเลือกใบที่คุ้มสุด',
    story: 'มีลด 500 บาท · ลด 12% · และลด 30% ที่ต้องซื้อครบ 50,000 (ยังไม่ถึง)',
    why: 'ให้ลูกค้าเลือกเองมักเลือกผิดแล้วรู้สึกว่าโดนเอาเปรียบทีหลัง',
    vouchers: [
      base({ code: C.a, kind: 'amount', value: 500 }),
      base({ code: C.b, kind: 'percent', value: 12 }),
      base({ code: C.c, kind: 'percent', value: 30, conditions: { minSpend: 50000 } }),
    ],
    steps: [{ do: 'best', context: { orderTotal: 10000 }, expect: { code: C.b, discount: 1200 } }],
  },
  {
    id: 'best-none',
    group: 'เลือกให้อัตโนมัติ',
    title: 'ไม่มีใบไหนใช้ได้เลย',
    story: 'ลูกค้ามีคูปองแต่ยอดยังไม่ถึงขั้นต่ำสักใบ',
    why: 'ต้องตอบว่า "ยังไม่มีใบไหนใช้ได้" ไม่ใช่พังหรือเลือกใบที่ใช้ไม่ได้มา',
    vouchers: [base({ conditions: { minSpend: 50000 } })],
    steps: [{ do: 'best', context: { orderTotal: 10000 }, expect: { none: true } }],
  },

  /* ─────────────── กลุ่ม 12 · QR ─────────────── */
  {
    id: 'qr-short-link',
    group: 'QR',
    title: 'QR ของลิงก์คูปองปกติ',
    story: 'ลิงก์ยาว 53 ตัวอักษร ใช้ QR รุ่นเล็กที่สแกนง่าย',
    why: 'QR ยิ่งละเอียดยิ่งสแกนยากในที่แสงน้อย ควรคุมลิงก์ให้สั้น',
    vouchers: [base()],
    steps: [{ do: 'qr', text: 'https://shop.example.com/voucher.html?c=SPE-7K4M-92XH', expect: { versionAtMost: 5 } }],
  },
  {
    id: 'qr-thai',
    group: 'QR',
    title: 'QR ที่มีภาษาไทย',
    story: 'อยากใส่ข้อความไทยลงใน QR โดยตรง',
    why: 'ต้องเข้ารหัสแบบที่รองรับตัวอักษรไทย ไม่ใช่ตัวอังกฤษล้วน',
    vouchers: [base()],
    steps: [{ do: 'qr', text: 'คูปองส่วนลด 500 บาท', expect: { versionAtMost: 10 } }],
  },
  {
    id: 'qr-too-long',
    group: 'QR',
    title: 'ข้อความยาวเกินที่ QR รับได้',
    story: 'เผลอยัดข้อมูลทั้งใบลงไปใน QR',
    why: 'ต้องฟ้องตอนสร้าง ไม่ใช่ปล่อย QR เสีย ๆ ออกไปให้ลูกค้าสแกนไม่ได้',
    vouchers: [base()],
    steps: [{ do: 'qr', text: 'x'.repeat(400), expect: { throws: true } }],
  },

  /* ─────────────── กลุ่ม 13 · เส้นทางเต็มของงานจริง ─────────────── */
  {
    id: 'flow-issue-to-redeem',
    group: 'เส้นทางเต็ม',
    title: 'ออกคูปอง 3 ใบ แล้วใช้จริงที่หน้าร้าน',
    story: 'แอดมินออกคูปองพาร์ทเนอร์ 3 ใบ → ลูกค้าถือใบแรกมาใช้ที่สาขา → พนักงานตัดสิทธิ์',
    why: 'เดินครบเส้นทางที่ใช้จริงทุกวัน ตั้งแต่ออกจนตัดสิทธิ์',
    issue: {
      count: 3,
      prefix: 'SPE',
      template: {
        kind: 'percent', value: 15, title: 'ส่วนลดพาร์ทเนอร์',
        conditions: { minSpend: 10000, maxDiscount: 2000 },
        audience: { segments: ['partner'] },
      },
    },
    steps: [
      { do: 'countIssued', expect: { count: 3, unique: true } },
      { do: 'check', code: '@issued0', context: { orderTotal: 24000, segments: ['partner'], channel: 'store' }, expect: { ok: true, discount: 2000, payable: 22000 } },
      { do: 'redeem', code: '@issued0', context: { orderTotal: 24000, segments: ['partner'], channel: 'store', staffId: 'staff_1' }, expect: { ok: true } },
      { do: 'check', code: '@issued0', context: { orderTotal: 24000, segments: ['partner'] }, expect: { ok: false, reason: 'already_redeemed' } },
      { do: 'check', code: '@issued1', context: { orderTotal: 24000, segments: ['partner'] }, expect: { ok: true } },
    ],
  },
  {
    id: 'flow-wallet-filter',
    group: 'เส้นทางเต็ม',
    title: 'กระเป๋าคูปองแยกใบที่ใช้ได้ออกจากใบที่จบแล้ว',
    story: 'ลูกค้ามี 4 ใบ: ใช้ได้ 1 · ยังไม่เริ่ม 1 · หมดอายุ 1 · ใช้แล้ว 1',
    why: 'ลูกค้าต้องเห็นใบที่ใช้ได้ทันที ไม่ต้องไล่หาในกองที่ใช้ไม่ได้แล้ว',
    vouchers: [
      base({ code: C.a }),
      base({ code: C.b, validFrom: iso(7) }),
      base({ code: C.c, validUntil: iso(-1) }),
      base({ code: C.d, state: 'redeemed' }),
    ],
    steps: [{ do: 'walletCounts', expect: { active: 1, scheduled: 1, expired: 1, redeemed: 1 } }],
  },
  {
    id: 'flow-order-of-reasons',
    group: 'เส้นทางเต็ม',
    title: 'ใบที่ผิดหลายข้อพร้อมกัน ต้องบอกข้อที่สำคัญที่สุด',
    story: 'คูปองหมดอายุแล้ว + ลูกค้าก็ไม่ใช่พาร์ทเนอร์ + ยอดก็ไม่ถึงขั้นต่ำ',
    why: 'บอก "ยอดไม่ถึง" ทั้งที่หมดอายุไปแล้ว = ลูกค้าไปเพิ่มของแล้วก็ยังใช้ไม่ได้อยู่ดี',
    vouchers: [base({ validUntil: iso(-1), audience: { segments: ['partner'] }, conditions: { minSpend: 50000 } })],
    steps: [{ do: 'check', code: C.a, context: { orderTotal: 1000, segments: ['public'] }, expect: { ok: false, reason: 'expired' } }],
  },
];

/* ════════════════════════════════════════════════════════════════════════
   ตัวรัน — ใช้ร่วมกันทั้งฝั่ง node และฝั่งเบราว์เซอร์
   ════════════════════════════════════════════════════════════════════════ */

/** เทียบผลจริงกับที่คาดไว้ คืนรายการที่ไม่ตรง */
function diff(actual, expect) {
  const bad = [];
  for (const [k, want] of Object.entries(expect)) {
    const got = actual[k];
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      bad.push(`${k}: ได้ ${JSON.stringify(got)} · ควรได้ ${JSON.stringify(want)}`);
    }
  }
  return bad;
}

/**
 * รัน 1 สถานการณ์
 * @returns {{id, title, group, pass, steps:[{label, pass, detail}]}}
 */
export async function runScenario(sc) {
  const svc = new VoucherService(new MemoryStore());
  const issued = [];

  if (sc.issue) {
    const made = await svc.issue(sc.issue.template, { count: sc.issue.count, prefix: sc.issue.prefix });
    issued.push(...made.map((v) => v.code));
  }
  if (sc.vouchers) await svc.load(sc.vouchers.map(createVoucher), { replace: false });

  const resolve = (code) => (String(code).startsWith('@issued') ? issued[Number(code.slice(7))] : code);
  const out = [];

  for (const step of sc.steps) {
    const label = describeStep(step);
    try {
      const bad = await runStep(step, { svc, resolve, issued, sc });
      out.push({ label, pass: bad.length === 0, detail: bad.join(' · ') });
    } catch (err) {
      out.push({ label, pass: false, detail: `พังระหว่างรัน: ${err.message}` });
    }
  }

  return { id: sc.id, title: sc.title, group: sc.group, story: sc.story, why: sc.why,
    pass: out.every((s) => s.pass), steps: out };
}

async function runStep(step, { svc, resolve, issued, sc }) {
  const want = step.expect || {};

  switch (step.do) {
    case 'check':
    case 'redeem': {
      const r = step.do === 'check'
        ? await svc.check(resolve(step.code), step.context || {})
        : await svc.redeem(resolve(step.code), step.context || {});
      const actual = {
        ok: r.ok,
        discount: r.discount,
        payable: r.payable,
        status: r.status,
        reason: r.reasons?.[0],
        freeShipping: r.freeShipping,
        freeItems: r.freeItems,
      };
      // เทียบเฉพาะช่องที่สถานการณ์ระบุไว้ ไม่บังคับให้ระบุครบทุกช่อง
      return diff(actual, want);
    }

    case 'reserve': {
      const r = await svc.reserve(resolve(step.code));
      return diff({ ok: r.ok }, want);
    }
    case 'release': {
      await svc.release(resolve(step.code));
      return [];
    }
    case 'void': {
      await svc.voidCode(resolve(step.code), 'ทดสอบ');
      return [];
    }

    case 'parse': {
      const r = parseCode(step.code);
      return diff({ ok: r.ok, code: r.code }, want);
    }

    case 'best': {
      const all = await svc.all();
      const b = bestVoucher(all, step.context || {});
      if (want.none) return b ? [`ควรไม่เจอใบที่ใช้ได้ แต่เจอ ${b.voucher.code}`] : [];
      if (!b) return ['ควรเจอใบที่คุ้มสุด แต่ไม่เจอเลย'];
      return diff({ code: b.voucher.code, discount: b.result.discount }, want);
    }

    case 'liveCode': {
      const now = Date.now();
      const shown = liveCode(step.voucherId, now);
      const verifies = verifyLiveCode(step.voucherId, shown, now + (step.offsetMs || 0));
      return diff({ verifies }, want);
    }

    case 'qr': {
      try {
        const r = encodeQr(step.text);
        if (want.throws) return ['ควรฟ้องว่ายาวเกิน แต่สร้างได้เฉย ๆ'];
        if (want.versionAtMost != null && r.version > want.versionAtMost) {
          return [`QR ใหญ่เกินไป: รุ่น ${r.version} · ควรไม่เกินรุ่น ${want.versionAtMost}`];
        }
        return [];
      } catch (err) {
        return want.throws ? [] : [`สร้าง QR ไม่ได้: ${err.message}`];
      }
    }

    case 'countIssued': {
      const bad = [];
      if (issued.length !== want.count) bad.push(`ออกได้ ${issued.length} ใบ · ควรได้ ${want.count}`);
      if (want.unique && new Set(issued).size !== issued.length) bad.push('มีรหัสซ้ำกัน');
      return bad;
    }

    case 'walletCounts': {
      const all = await svc.all();
      const got = {};
      for (const v of all) {
        const s = deriveStatus(v);
        got[s] = (got[s] || 0) + 1;
      }
      return diff(got, want);
    }

    default:
      return [`ไม่รู้จักคำสั่ง "${step.do}"`];
  }
}

/** แปลงขั้นตอนเป็นข้อความไทยสั้น ๆ ให้คนอ่านรู้ว่ากำลังทำอะไร */
function describeStep(step) {
  switch (step.do) {
    case 'check': return `ตรวจคูปอง${step.context?.orderTotal ? ` (ยอด ${step.context.orderTotal.toLocaleString()})` : ''}`;
    case 'redeem': return 'ตัดสิทธิ์';
    case 'reserve': return 'จองไว้ระหว่างจ่ายเงิน';
    case 'release': return 'ยกเลิกการจอง';
    case 'void': return 'แอดมินยกเลิกคูปอง';
    case 'parse': return `อ่านรหัส "${step.code}"`;
    case 'best': return 'ให้ระบบเลือกใบที่คุ้มสุด';
    case 'liveCode': return 'ตรวจรหัสยืนยันสด';
    case 'qr': return 'สร้าง QR';
    case 'countIssued': return 'นับใบที่ออกได้';
    case 'walletCounts': return 'นับคูปองในกระเป๋าตามสถานะ';
    default: return step.do;
  }
}

/** รันทุกสถานการณ์ */
export async function runAll() {
  const results = [];
  for (const sc of SCENARIOS) results.push(await runScenario(sc));
  return results;
}

/** กลุ่มทั้งหมดตามลำดับที่ปรากฏ */
export const GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];

/** ใช้ตรวจว่าครอบคลุมครบไหม — เทียบกับรายการจริงใน schema/rules */
export function coverage() {
  const text = JSON.stringify(SCENARIOS);
  const kinds = ['percent', 'amount', 'fixed_price', 'free_item', 'free_shipping'];
  const reasons = [
    'bad_code', 'not_found', 'voided', 'already_redeemed', 'expired', 'not_started',
    'reserved', 'wrong_customer', 'segment', 'limit_per_person', 'channel', 'branch',
    'product_scope', 'min_spend', 'not_combinable',
  ];
  const statuses = ['active', 'scheduled', 'expired', 'redeemed', 'void', 'reserved'];
  const has = (x) => text.includes(`"${x}"`);
  return {
    kinds: { total: kinds.length, missing: kinds.filter((k) => !has(k)) },
    reasons: { total: reasons.length, missing: reasons.filter((r) => !has(r)) },
    statuses: { total: statuses.length, missing: statuses.filter((s) => !has(s)) },
  };
}

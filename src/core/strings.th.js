/**
 * strings.th.js — ข้อความบนจอ "ทุกคำ" อยู่ที่นี่ที่เดียว
 * ---------------------------------------------------------------------------
 * กฎ: ไฟล์ UI ห้ามพิมพ์ข้อความไทย/อังกฤษลงไปตรง ๆ  ต้องเรียกผ่าน t('คีย์')
 * เหตุผล: (1) แก้คำทีเดียวเปลี่ยนทั้งระบบ  (2) เพิ่มภาษาอื่นทีหลังได้ฟรี
 *         (3) หาต้นตอ "คำนี้มาจากไหน" ได้ใน 1 วินาที
 *
 * เพิ่มภาษา: ก๊อปไฟล์นี้เป็น strings.en.js แล้ว setLocale('en')
 */

export const TH = {
  common: {
    close: 'ปิด',
    cancel: 'ยกเลิก',
    confirm: 'ยืนยัน',
    copy: 'คัดลอก',
    copied: 'คัดลอกแล้ว',
    back: 'ย้อนกลับ',
    all: 'ทั้งหมด',
    baht: 'บาท',
    bahtSign: '฿',
    percent: '%',
    and: 'และ',
  },

  /* ---- ชนิดของสิทธิ์ (แสดงเป็นคำกำกับเล็ก ๆ บนการ์ด) ---- */
  kind: {
    percent: 'ส่วนลด',
    amount: 'ส่วนลด',
    fixed_price: 'ราคาพิเศษ',
    free_item: 'ของแถม',
    free_shipping: 'ส่งฟรี',
  },

  /* ---- สถานะคูปอง ---- */
  status: {
    draft: 'ฉบับร่าง',
    scheduled: 'ยังไม่เริ่ม',
    active: 'ใช้ได้',
    reserved: 'กำลังใช้',
    redeemed: 'ใช้แล้ว',
    expired: 'หมดอายุ',
    void: 'ถูกยกเลิก',
  },

  /* ---- กลุ่มลูกค้าที่ระบบรองรับ ---- */
  segment: {
    public: 'ทุกคน',
    partner: 'พาร์ทเนอร์',
    vip: 'ลูกค้าประจำ',
    returning: 'ลูกค้าเก่า',
    new: 'ลูกค้าใหม่',
    staff: 'พนักงาน',
  },

  /* ---- บนตัวการ์ด ---- */
  card: {
    codeLabel: 'รหัสคูปอง',
    expiresPrefix: 'ใช้ได้ถึง',
    startsPrefix: 'เริ่มใช้ได้',
    noExpiry: 'ไม่มีวันหมดอายุ',
    minSpendPrefix: 'เมื่อซื้อครบ',
    maxDiscountPrefix: 'ลดสูงสุด',
    perPersonSuffix: 'ต่อคน',
    forSegmentPrefix: 'สำหรับ',
    useNow: 'ใช้สิทธิ์นี้',
    holdToUse: 'กดค้างเพื่อใช้สิทธิ์',
    showToStaff: 'แสดงหน้านี้ให้พนักงาน',
    detailsToggle: 'เงื่อนไขการใช้',
    remainingPrefix: 'เหลืออีก',
    remainingSuffix: 'สิทธิ์',
    daysLeftPrefix: 'เหลืออีก',
    daysLeftSuffix: 'วัน',
    lastDay: 'วันสุดท้าย',
    expiresToday: 'หมดอายุวันนี้',
  },

  /* ---- ขั้นตอนใช้สิทธิ์ ---- */
  redeem: {
    holdHint: 'กดค้าง 1 วินาที',
    releasedEarly: 'ปล่อยเร็วไป ลองใหม่อีกครั้ง',
    confirmTitle: 'ยืนยันการใช้สิทธิ์',
    confirmBody: 'ใช้แล้วคูปองใบนี้จะใช้ซ้ำไม่ได้ ใช้ตอนอยู่หน้าเคาน์เตอร์เท่านั้น',
    confirmAction: 'ใช้สิทธิ์เลย',
    doneTitle: 'ใช้สิทธิ์เรียบร้อย',
    doneHint: 'ให้พนักงานดูหน้าจอนี้',
    liveCodeLabel: 'รหัสยืนยันสด',
    liveCodeHint: 'เปลี่ยนทุก 30 วินาที · ภาพหน้าจอใช้ไม่ได้',
    usedAtPrefix: 'ใช้เมื่อ',
    failTitle: 'ใช้สิทธิ์ไม่ได้',
  },

  /* ---- เหตุผลที่ใช้ไม่ได้ (ผูกกับ rules.js) ---- */
  reject: {
    not_found: 'ไม่พบคูปองรหัสนี้',
    bad_code: 'รหัสไม่ถูกต้อง พิมพ์ตกหรือเกินหรือเปล่า',
    not_started: 'ยังไม่ถึงวันเริ่มใช้',
    expired: 'คูปองหมดอายุแล้ว',
    already_redeemed: 'คูปองนี้ถูกใช้ไปแล้ว',
    voided: 'คูปองนี้ถูกยกเลิก',
    reserved: 'คูปองกำลังถูกใช้อยู่ที่อื่น รออีกสักครู่',
    min_spend: 'ยอดซื้อยังไม่ถึงขั้นต่ำ',
    segment: 'คูปองนี้เฉพาะกลุ่มลูกค้าที่กำหนด',
    wrong_customer: 'คูปองนี้ออกให้ลูกค้าคนอื่น',
    channel: 'ช่องทางนี้ใช้คูปองนี้ไม่ได้',
    branch: 'สาขานี้ใช้คูปองนี้ไม่ได้',
    product_scope: 'สินค้าในตะกร้าไม่เข้าเงื่อนไข',
    limit_per_person: 'คุณใช้สิทธิ์นี้ครบจำนวนแล้ว',
    limit_total: 'สิทธิ์ถูกใช้หมดแล้ว',
    not_combinable: 'ใช้ร่วมกับส่วนลดอื่นไม่ได้',
  },

  /* ---- หน้ากระเป๋าคูปองของลูกค้า ---- */
  wallet: {
    title: 'กระเป๋าคูปอง',
    filterUsable: 'ใช้ได้',
    filterUpcoming: 'ยังไม่เริ่ม',
    filterUsed: 'ใช้แล้ว/หมดอายุ',
    emptyUsable: 'ยังไม่มีคูปองที่ใช้ได้ตอนนี้',
    emptyUsableHint: 'มีโปรใหม่เมื่อไหร่จะขึ้นตรงนี้',
    emptyUsed: 'ยังไม่มีประวัติการใช้',
    countSuffix: 'ใบ',
    greetingPrefix: 'สวัสดี',
  },

  /* ---- ฝั่งร้าน/พนักงาน ---- */
  staff: {
    title: 'ตรวจคูปอง',
    subtitle: 'กรอกรหัสที่ลูกค้าแสดง',
    codePlaceholder: 'เช่น SPE-7K4M-92XQ',
    check: 'ตรวจสอบ',
    markUsed: 'ตัดสิทธิ์',
    orderTotalLabel: 'ยอดก่อนลด (บาท)',
    resultValid: 'ใช้ได้',
    resultInvalid: 'ใช้ไม่ได้',
    willDiscountPrefix: 'ส่วนลดที่ได้',
    payPrefix: 'ยอดที่ต้องจ่าย',
    liveCodePrompt: 'ให้ลูกค้าอ่านรหัสยืนยันสด 4 ตัว',
    liveCodeMismatch: 'รหัสยืนยันสดไม่ตรง',
  },

  /* ---- ฝั่งออกคูปอง (แอดมิน) ---- */
  admin: {
    title: 'ออกคูปอง',
    campaign: 'แคมเปญ',
    kind: 'ชนิดสิทธิ์',
    value: 'มูลค่า',
    minSpend: 'ยอดขั้นต่ำ',
    maxDiscount: 'ลดสูงสุด',
    audience: 'กลุ่มเป้าหมาย',
    validFrom: 'เริ่ม',
    validUntil: 'หมด',
    quantity: 'จำนวนใบ',
    prefix: 'อักษรนำหน้ารหัส',
    generate: 'สร้างคูปอง',
    preview: 'ตัวอย่าง',
    exportJson: 'ดาวน์โหลด JSON',
    generatedPrefix: 'สร้างแล้ว',
  },

  /* ---- ข้อความเวลา ---- */
  time: {
    justNow: 'เมื่อครู่นี้',
    minutesAgoSuffix: 'นาทีที่แล้ว',
    hoursAgoSuffix: 'ชั่วโมงที่แล้ว',
    daysAgoSuffix: 'วันที่แล้ว',
  },
};

const BUNDLES = { th: TH };
let current = 'th';

/** เปลี่ยนภาษาทั้งระบบ */
export function setLocale(code) {
  if (BUNDLES[code]) current = code;
  return current;
}

/** ลงทะเบียนภาษาใหม่ เช่น registerLocale('en', EN) */
export function registerLocale(code, bundle) {
  BUNDLES[code] = bundle;
}

/**
 * อ่านข้อความด้วยคีย์แบบจุด เช่น t('status.active')
 * ถ้าไม่เจอคีย์จะคืนคีย์นั้นกลับไป (จะได้เห็นทันทีบนจอว่าลืมใส่คำ)
 */
export function t(path, vars) {
  const parts = String(path).split('.');
  let node = BUNDLES[current];
  for (const p of parts) {
    if (node && typeof node === 'object' && p in node) node = node[p];
    else return path;
  }
  if (typeof node !== 'string') return path;
  if (!vars) return node;
  return node.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

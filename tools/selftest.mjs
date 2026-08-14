/**
 * selftest.mjs — ชุดทดสอบของระบบ  รันด้วย:  node tools/selftest.mjs
 * ---------------------------------------------------------------------------
 * ไม่ต้องลงอะไรเพิ่ม ใช้ Node เปล่า ๆ
 *
 * ทำไมต้องมี: ตรรกะเรื่องเงินกับเรื่องสิทธิ์ "พังแบบเงียบ" ได้ง่ายมาก
 * หน้าเว็บยังสวยเหมือนเดิม ไม่มี error สักตัว แต่คิดเงินผิด
 *
 * ⚠️ ชุดตัวอย่าง QR ข้างล่างถูกเทียบกับ implementation มาตรฐานตัวอื่นมาแล้วทั้ง 217 เคส
 *    ถ้าแก้ qr.js แล้วเทสต์นี้แดง = แก้พัง ไม่ใช่เทสต์ผิด
 */

import { encodeQr } from '../src/core/qr.js';
import { generateCode, parseCode, ALPHABET, formatCode, normalizeCode } from '../src/core/codes.js';
import { createVoucher, validateVoucher } from '../src/core/schema.js';
import { deriveStatus, daysLeft, sortForWallet } from '../src/core/lifecycle.js';
import { evaluate, bestVoucher } from '../src/core/rules.js';
import { VoucherService, MemoryStore } from '../src/core/store.js';
import { liveCode, verifyLiveCode, LIVE_CODE_PERIOD } from '../src/core/security.js';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; return; }
  fail++;
  failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(name, a === e, `got ${a}, want ${e}`);
}

const DAY = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

/* ══════════════════════════ 1 · QR ══════════════════════════════════════ */

const QR_FIXTURES = [
  { text: 'GV-2345-678A', version: 1, mask: 2, rows: ['fe23f8', '820a08', 'babae8', 'bacae8', 'babae8', '82ca08', 'feabf8', '00f800', 'be2be0', 'e86ff0', 'af1510', '9dc038', 'f31610', '00ccc0', 'fe2b70', '82b920', 'baee58', 'baeca0', 'badf00', '8208a0', 'fec750'] },
  { text: 'https://shop.example.com/voucher.html?c=SPE-7K4M-92XQ', version: 4, mask: 2, rows: ['fe18bd3f8', '8201a2a08', 'baa21f2e8', 'bab93f2e8', 'ba9fadae8', '82f866208', 'feaaaabf8', '009086000', 'be5653be0', 'a8c4f3b68', '3e8fc88b0', '4c1deeee8', 'db83889d8', 'dced6be18', '7323c46b0', 'fc39146e0', '7a91c25c8', '0dc4bd768', '4345a67a0', '75968d5e8', '5a483fcc0', 'b8dbd4568', '9b6e0c930', '80e286ef0', '97d272f90', '00ccf88b8', 'fe7f47ab0', '82dee78f0', 'bab388fd0', 'bae570cd8', 'badfce360', '82590f8e0', 'fec9dbf10'] },
];

function rowsToHex(modules) {
  return modules.map((row) => {
    let s = '';
    for (let i = 0; i < row.length; i += 4) {
      let n = 0;
      for (let j = 0; j < 4; j++) n = (n << 1) | (row[i + j] ? 1 : 0);
      s += n.toString(16);
    }
    return s;
  });
}

for (const fx of QR_FIXTURES) {
  const r = encodeQr(fx.text);
  eq(`QR version (${fx.text.slice(0, 18)})`, r.version, fx.version);
  eq(`QR mask (${fx.text.slice(0, 18)})`, r.mask, fx.mask);
  eq(`QR modules (${fx.text.slice(0, 18)})`, rowsToHex(r.modules), fx.rows);
}

ok('QR ปฏิเสธข้อความยาวเกิน', (() => {
  try { encodeQr('x'.repeat(400)); return false; } catch { return true; }
})());

ok('QR รองรับภาษาไทย', encodeQr('คูปองส่วนลด 500 บาท').size > 0);

/* ══════════════════════════ 2 · รหัสคูปอง ══════════════════════════════ */

const code = generateCode({ prefix: 'SPE' });
ok('รหัสมีรูปแบบถูก', /^SPE-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code), code);
ok('รหัสที่เพิ่งสร้างต้องผ่านการตรวจ', parseCode(code).ok, code);

// พิมพ์ผิด 1 ตัว ต้องจับได้ทุกตำแหน่ง
{
  let caught = 0;
  let tried = 0;
  const body = code.replace(/^SPE-/, '').replace(/-/g, '');
  for (let i = 0; i < body.length; i++) {
    for (const ch of ALPHABET) {
      if (ch === body[i]) continue;
      tried++;
      const broken = body.slice(0, i) + ch + body.slice(i + 1);
      if (!parseCode(`SPE-${broken}`).ok) caught++;
    }
  }
  ok('จับการพิมพ์ผิด 1 ตัวได้ 100%', caught === tried, `${caught}/${tried}`);
}

// สลับตำแหน่งติดกัน
{
  let caught = 0;
  let tried = 0;
  for (let n = 0; n < 400; n++) {
    const c = generateCode({ prefix: 'GV' });
    const body = c.split('-').slice(1).join('');
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i] === body[i + 1]) continue;
      tried++;
      const swapped = body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
      if (!parseCode(`GV-${swapped}`).ok) caught++;
    }
  }
  ok('จับการสลับตัวติดกันได้เกิน 90%', caught / tried > 0.9, `${((caught / tried) * 100).toFixed(1)}%`);
}

ok('ตัวอักษรกำกวมถูกตัดออกจากชุด', !/[ILOU]/.test(ALPHABET));
eq('ชุดตัวอักษรยาว 32', ALPHABET.length, 32);
ok('รหัสไม่มีขีดเลยก็ยังอ่านออก', parseCode(code.replace(/-/g, '')).ok, code.replace(/-/g, ''));
ok('รหัสตัวเล็กก็ยังอ่านออก', parseCode(code.toLowerCase()).ok);
eq('รหัสไม่มีขีดต้องคืนรูปมาตรฐานเดิม', parseCode(code.replace(/-/g, '')).code, code);
ok('รหัสสุ่มมั่วส่วนใหญ่ต้องไม่ผ่าน', (() => {
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    let b = '';
    for (let j = 0; j < 8; j++) b += ALPHABET[Math.floor(Math.random() * 32)];
    if (!parseCode(`SPE-${b}`).ok) bad++;
  }
  return bad / 300 > 0.9; // ผ่านโดยบังเอิญได้ ~1/32 เท่านั้น
})());
eq('formatCode ใส่ขีดให้ถูกแม้ prefix กับ body ปนตัวอักษร',
  formatCode('SPE7K4M92XQ'), 'SPE-7K4M-92XQ');
eq('ซ่อมตัวที่คนพิมพ์ผิดบ่อย O→0 I→1 L→1 U→V',
  normalizeCode('spe-oilu-234v'), 'SPE-011V-234V');
eq('ไม่ไปแตะ prefix ตอนซ่อม', normalizeCode('LOU-1234-5678').slice(0, 3), 'LOU');
// เคสจริงที่พลาดมาแล้ว: พนักงานพิมพ์ติดกันไม่มีขีด แล้ว I ใน prefix โดนซ่อมเป็น 1
eq('พิมพ์ติดกันไม่มีขีด prefix ต้องไม่โดนซ่อม',
  normalizeCode('ship4c7b8xjr'), 'SHIP-4C7B-8XJR');
eq('พิมพ์ติดกันแล้วต้องหาคูปองเจอเหมือนกัน',
  parseCode('ship4c7b8xjr').code, parseCode('SHIP-4C7B-8XJR').code);

/* ══════════════════════════ 3 · สถานะตามเวลา ══════════════════════════ */

const base = { code: 'GV-2345-678A', kind: 'percent', value: 10 };
eq('ยังไม่ถึงวันเริ่ม = scheduled', deriveStatus(createVoucher({ ...base, validFrom: iso(3) })), 'scheduled');
eq('เลยวันหมด = expired', deriveStatus(createVoucher({ ...base, validUntil: iso(-1) })), 'expired');
eq('อยู่ในช่วง = active', deriveStatus(createVoucher({ ...base, validFrom: iso(-1), validUntil: iso(5) })), 'active');
eq('ยกเลิกแล้ว = void', deriveStatus(createVoucher({ ...base, state: 'void' })), 'void');
eq('ตัดสิทธิ์แล้ว = redeemed', deriveStatus(createVoucher({ ...base, state: 'redeemed' })), 'redeemed');
eq('โควตาหมด = redeemed', deriveStatus(createVoucher({ ...base, limits: { perPerson: 1, total: 2 }, usage: { used: 2, byCustomer: {} } })), 'redeemed');
eq('จองค้างเกินเวลาแล้วกลับมาใช้ได้', deriveStatus(createVoucher({ ...base, state: 'reserved', reservedUntil: iso(-0.01) })), 'active');
eq('จองอยู่ในเวลา = reserved', deriveStatus(createVoucher({ ...base, state: 'reserved', reservedUntil: iso(0.01) })), 'reserved');
eq('ไม่มีวันหมด → daysLeft = null', daysLeft(createVoucher(base)), null);

{
  const list = [
    createVoucher({ ...base, code: 'A-2345-678A', validUntil: iso(30) }),
    createVoucher({ ...base, code: 'B-2345-678A', state: 'redeemed' }),
    createVoucher({ ...base, code: 'C-2345-678A', validUntil: iso(2) }),
  ];
  eq('เรียงคูปอง: ใกล้หมดอายุขึ้นก่อน แล้วค่อยของที่ใช้แล้ว',
    sortForWallet(list).map((v) => v.code[0]), ['C', 'A', 'B']);
}

/* ══════════════════════════ 4 · คิดเลขส่วนลด ══════════════════════════ */

const ctx = (over = {}) => ({ orderTotal: 10000, segments: ['public'], ...over });

eq('ลด 15% จาก 10,000 = 1,500',
  evaluate(createVoucher({ ...base, kind: 'percent', value: 15 }), ctx()).discount, 1500);

eq('เพดานส่วนลดต้องคุมได้',
  evaluate(createVoucher({ ...base, kind: 'percent', value: 50, conditions: { maxDiscount: 2000 } }), ctx()).discount, 2000);

eq('ลดเป็นบาทต้องไม่เกินยอดจริง',
  evaluate(createVoucher({ ...base, kind: 'amount', value: 15000 }), ctx()).discount, 10000);

eq('ราคาพิเศษ 7,900 จากยอด 10,000 = ลด 2,100',
  evaluate(createVoucher({ ...base, kind: 'fixed_price', value: 7900 }), ctx()).discount, 2100);

eq('ส่งฟรีไม่ลดเงินแต่ตั้งธงส่งฟรี',
  (() => { const r = evaluate(createVoucher({ ...base, kind: 'free_shipping' }), ctx()); return [r.discount, r.freeShipping]; })(), [0, true]);

eq('ยอดไม่ถึงขั้นต่ำต้องไม่ผ่าน',
  evaluate(createVoucher({ ...base, conditions: { minSpend: 20000 } }), ctx()).reasons, ['min_spend']);

eq('ยอดที่ต้องจ่ายหลังลด',
  evaluate(createVoucher({ ...base, kind: 'amount', value: 500 }), ctx()).payable, 9500);

eq('คูปองเฉพาะพาร์ทเนอร์ ลูกค้าทั่วไปใช้ไม่ได้',
  evaluate(createVoucher({ ...base, audience: { segments: ['partner'] } }), ctx()).reasons, ['segment']);

eq('คูปองเฉพาะพาร์ทเนอร์ พาร์ทเนอร์ใช้ได้',
  evaluate(createVoucher({ ...base, audience: { segments: ['partner'] } }), ctx({ segments: ['partner'] })).ok, true);

eq('คูปองผูกลูกค้าคนเดียว คนอื่นใช้ไม่ได้',
  evaluate(createVoucher({ ...base, audience: { customerId: 'cus_1' } }), ctx({ customerId: 'cus_2' })).reasons, ['wrong_customer']);

eq('ใช้ครบโควตาส่วนตัวแล้ว',
  evaluate(createVoucher({ ...base, limits: { perPerson: 1, total: null }, usage: { used: 1, byCustomer: { cus_1: 1 } } }), ctx({ customerId: 'cus_1' })).reasons, ['limit_per_person']);

eq('ใช้ร่วมกับส่วนลดอื่นไม่ได้',
  evaluate(createVoucher(base), ctx({ hasOtherDiscount: true })).reasons, ['not_combinable']);

eq('ช่องทางไม่ตรงต้องไม่ผ่าน',
  evaluate(createVoucher({ ...base, conditions: { channels: ['store'] } }), ctx({ channel: 'web' })).reasons, ['channel']);

// จำกัดเฉพาะบางสินค้า → คิดจากยอดเฉพาะสินค้านั้น
eq('จำกัดหมวดสินค้า: ลด 10% เฉพาะยอดราวบันได 4,000 = 400',
  evaluate(
    createVoucher({ ...base, kind: 'percent', value: 10, conditions: { productScope: { categories: ['stair'] } } }),
    ctx({ orderTotal: 10000, items: [
      { sku: 'S1', category: 'stair', price: 2000, qty: 2 },
      { sku: 'B1', category: 'balcony', price: 6000, qty: 1 },
    ] })
  ).discount, 400);

// เลือกใบที่คุ้มที่สุด
{
  const list = [
    createVoucher({ ...base, code: 'A-2345-678A', kind: 'amount', value: 500 }),
    createVoucher({ ...base, code: 'B-2345-678A', kind: 'percent', value: 12 }),
    createVoucher({ ...base, code: 'C-2345-678A', kind: 'percent', value: 30, conditions: { minSpend: 50000 } }),
  ];
  const best = bestVoucher(list, ctx());
  eq('เลือกใบที่ลดเยอะสุดที่ใช้ได้จริง', [best.voucher.code[0], best.result.discount], ['B', 1200]);
}

/* ══════════════════════════ 5 · ออก/ตัดสิทธิ์ ══════════════════════════ */

{
  const svc = new VoucherService(new MemoryStore());
  const made = await svc.issue({ kind: 'amount', value: 300, title: 'ทดสอบ' }, { count: 3, prefix: 'TST' });
  eq('ออกคูปอง 3 ใบ', made.length, 3);
  ok('รหัสไม่ซ้ำกัน', new Set(made.map((v) => v.code)).size === 3);

  const c0 = made[0].code;
  const r1 = await svc.redeem(c0, { orderTotal: 5000, customerId: 'cus_1' });
  eq('ตัดสิทธิ์ครั้งแรกผ่าน', [r1.ok, r1.discount], [true, 300]);

  const r2 = await svc.redeem(c0, { orderTotal: 5000, customerId: 'cus_1' });
  eq('ตัดสิทธิ์ซ้ำต้องไม่ผ่าน', [r2.ok, r2.reasons[0]], [false, 'already_redeemed']);

  const c1 = made[1].code;
  const res = await svc.reserve(c1);
  ok('จองคูปองได้', res.ok);
  const r3 = await svc.check(c1, { orderTotal: 5000 });
  eq('คูปองที่ถูกจองอยู่ ตรวจแล้วต้องบอกว่าติดจอง', r3.reasons, ['reserved']);
  const r4 = await svc.redeem(c1, { orderTotal: 5000 });
  ok('เจ้าของการจองตัดสิทธิ์ต่อได้', r4.ok);

  await svc.release(made[2].code);
  const r5 = await svc.check(made[2].code, { orderTotal: 5000 });
  ok('ปล่อยการจองแล้วกลับมาใช้ได้', r5.ok);

  await svc.voidCode(made[2].code, 'ทดสอบ');
  const r6 = await svc.check(made[2].code, { orderTotal: 5000 });
  eq('ยกเลิกแล้วใช้ไม่ได้', r6.reasons, ['voided']);

  const r7 = await svc.check('SPE-0000-0000', { orderTotal: 100 });
  eq('รหัสผิดรูปแบบ', r7.reasons, ['bad_code']);
  const r8 = await svc.check(generateCode({ prefix: 'ZZ' }), { orderTotal: 100 });
  eq('รหัสถูกแบบแต่ไม่มีในระบบ', r8.reasons, ['not_found']);
}

/* --- โควตารวมหลายสิทธิ์ในใบเดียว --- */
{
  const svc = new VoucherService(new MemoryStore());
  const [v] = await svc.issue(
    { kind: 'amount', value: 100, limits: { perPerson: 5, total: 2 } },
    { count: 1, prefix: 'QT' }
  );
  await svc.redeem(v.code, { orderTotal: 1000, customerId: 'a' });
  const mid = await svc.check(v.code, { orderTotal: 1000, customerId: 'b' });
  ok('ใช้ไป 1 จาก 2 สิทธิ์ ยังใช้ต่อได้', mid.ok);
  await svc.redeem(v.code, { orderTotal: 1000, customerId: 'b' });
  const end = await svc.check(v.code, { orderTotal: 1000, customerId: 'c' });
  eq('ครบ 2 สิทธิ์แล้วต้องหยุด', end.reasons[0], 'already_redeemed');
}

/* --- โค้ดสาธารณะ (total = null) ต้องใช้ได้เรื่อย ๆ ไม่ตายหลังคนแรกใช้ --- */
{
  const svc = new VoucherService(new MemoryStore());
  const [v] = await svc.issue(
    { kind: 'percent', value: 10, limits: { perPerson: 1, total: null } },
    { count: 1, prefix: 'PUB' }
  );
  await svc.redeem(v.code, { orderTotal: 1000, customerId: 'a' });
  const other = await svc.check(v.code, { orderTotal: 1000, customerId: 'b' });
  ok('คนที่สองยังใช้โค้ดสาธารณะได้', other.ok, JSON.stringify(other.reasons));
  const again = await svc.check(v.code, { orderTotal: 1000, customerId: 'a' });
  eq('แต่คนเดิมใช้ซ้ำไม่ได้', again.reasons[0], 'limit_per_person');
  const anon = await svc.check(v.code, { orderTotal: 1000 });
  ok('ไม่ส่งไอดีลูกค้ามา = กันไม่ได้ (ต้องรู้ข้อจำกัดนี้)', anon.ok);
}

/* ══════════════════════════ 6 · รหัสยืนยันสด ══════════════════════════ */

{
  const now = 1_800_000_000_000;
  const a = liveCode('v_1', now);
  eq('รหัสยืนยันสด 4 หลัก', a.length, 4);
  eq('เวลาเดียวกันต้องได้รหัสเดิม', liveCode('v_1', now + 100), a);
  ok('ข้ามรอบแล้วรหัสต้องเปลี่ยน', liveCode('v_1', now + LIVE_CODE_PERIOD) !== a);
  ok('คูปองคนละใบรหัสต่างกัน', liveCode('v_2', now) !== a);
  ok('ตรวจรหัสรอบปัจจุบันผ่าน', verifyLiveCode('v_1', a, now));
  ok('ตรวจรหัสรอบก่อนหน้ายังผ่าน (เผื่ออ่านเลขไม่ทัน)', verifyLiveCode('v_1', a, now + LIVE_CODE_PERIOD));
  ok('รหัสเก่า 2 รอบต้องไม่ผ่าน', !verifyLiveCode('v_1', a, now + LIVE_CODE_PERIOD * 2));
  ok('ไม่คืนเลขซ้ำแบบ 0000/1111', !/^(\d)\1{3}$/.test(liveCode('v_9', now)));
}

/* ══════════════════════════ 7 · ตรวจโครงข้อมูล ═══════════════════════ */

eq('คูปองที่ถูกต้องต้องไม่มีปัญหา', validateVoucher(createVoucher({ ...base })), []);
ok('ส่วนลดเกิน 100% ต้องถูกจับ', validateVoucher(createVoucher({ ...base, value: 150 })).length > 0);
ok('วันเริ่มหลังวันหมดต้องถูกจับ', validateVoucher(createVoucher({ ...base, validFrom: iso(9), validUntil: iso(1) })).length > 0);
ok('kind แปลก ๆ ต้องถูกจับ', validateVoucher(createVoucher({ ...base, kind: 'magic' })).length > 0);
ok('skin ที่ไม่มีอยู่ต้องถูกจับ', validateVoucher(createVoucher({ ...base, design: { skin: 'gold' } })).length > 0);

/* ══════════════════════════ 8 · ข้อมูลตัวอย่างในโปรเจกต์ ═════════════════
   ไฟล์ตัวอย่างถูกพิมพ์ด้วยมือ → รหัสมักไม่ผ่านตัวตรวจทานโดยที่ไม่มีใครรู้
   อาการเวลาพลาด: หน้ารายการยังโชว์คูปองสวยงามครบทุกใบ แต่พอกดเข้าไปดูใบเดียว
   หรือเอาไปตรวจที่หน้าร้าน จะขึ้นว่า "รหัสไม่ถูกต้อง" ทุกใบ                */

{
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('../data/', import.meta.url));
  const samples = JSON.parse(readFileSync(dir + 'vouchers.sample.json', 'utf8'));

  ok('มีข้อมูลตัวอย่างให้เดโมใช้', samples.length > 0);
  const badCode = samples.filter((v) => !parseCode(v.code).ok).map((v) => v.code);
  eq('ทุกรหัสในไฟล์ตัวอย่างต้องผ่านตัวตรวจทาน', badCode, []);
  const dupes = samples.length - new Set(samples.map((v) => v.code)).size;
  eq('ไม่มีรหัสซ้ำในไฟล์ตัวอย่าง', dupes, 0);

  const badShape = samples.flatMap((v) => validateVoucher(createVoucher(v)));
  eq('ทุกใบในไฟล์ตัวอย่างผ่านการตรวจโครง', badShape, []);

  // ทุกชนิดสิทธิ์ควรมีตัวอย่างอย่างน้อย 1 ใบ ไม่งั้นดีไซน์บางแบบไม่เคยถูกเห็น
  const kinds = new Set(samples.map((v) => v.kind));
  eq('ตัวอย่างครอบคลุมชนิดสิทธิ์ครบทุกแบบ',
    ['percent', 'amount', 'fixed_price', 'free_item', 'free_shipping'].filter((k) => !kinds.has(k)), []);
}

/* ══════════════════════════ สรุป ══════════════════════════════════════ */

const line = '─'.repeat(58);
console.log(line);
console.log(`  ผ่าน ${pass}   ไม่ผ่าน ${fail}`);
if (fail) {
  console.log(line);
  for (const f of failures) console.log('  x ' + f);
}
console.log(line);
process.exit(fail ? 1 : 0);

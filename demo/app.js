/**
 * app.js — ตัวช่วยที่ทั้ง 4 หน้าจอตัวอย่างใช้ร่วมกัน
 * ---------------------------------------------------------------------------
 * ตัวอย่างนี้เก็บข้อมูลไว้ในเบราว์เซอร์ (localStorage) เพื่อให้ลองใช้ได้จริง
 * โดยไม่ต้องมีเซิร์ฟเวอร์  ตอนต่อของจริงเปลี่ยนแค่บรรทัดเดียว:
 *
 *     new VoucherService(new LocalStore())          ← ตัวอย่าง
 *     new VoucherService(new HttpStore('/api'))     ← ของจริง
 */

import { VoucherService, LocalStore } from '../src/index.js';

const STORE_KEY = 'voucherkit.demo.v1';
const SEED_MARK = 'voucherkit.demo.seed';

let servicePromise = null;

/**
 * คืน service ตัวเดียวกันทุกหน้า พร้อมโหลดข้อมูลตัวอย่างครั้งแรก
 *
 * ⚠️ จุดที่เคยพลาด: ถ้าใช้แค่ธง "เคยโหลดแล้วหรือยัง" พอแก้ไฟล์ตัวอย่างทีหลัง
 *    เบราว์เซอร์จะยังถือข้อมูลชุดเก่าไว้ตลอด → กดคูปองแล้วขึ้น "ไม่พบคูปองรหัสนี้"
 *    ทั้งที่ไฟล์ตัวอย่างถูกต้อง  จึงจำ "ลายเซ็นของชุดข้อมูล" ไว้แทน
 *    ชุดข้อมูลเปลี่ยนเมื่อไหร่ = โหลดใหม่อัตโนมัติ
 */
export function getService() {
  if (servicePromise) return servicePromise;
  servicePromise = (async () => {
    const svc = new VoucherService(new LocalStore(STORE_KEY));
    const seed = await (await fetch('../data/vouchers.sample.json')).json();
    const mark = `${seed.length}:${seed[0]?.code || ''}`;
    if (localStorage.getItem(SEED_MARK) !== mark) {
      await svc.load(seed, { replace: true });
      localStorage.setItem(SEED_MARK, mark);
    }
    return svc;
  })();
  return servicePromise;
}

/** ล้างข้อมูลตัวอย่างกลับไปเป็นค่าเริ่มต้น */
export function resetDemo() {
  localStorage.removeItem(SEED_MARK);
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

/** ลูกค้าสมมติของหน้าตัวอย่าง */
export const DEMO_CUSTOMER = {
  id: 'cus_1029',
  name: 'คุณสมชาย',
  segments: ['vip', 'returning', 'partner'],
};

/** อ่านค่าจาก query string */
export const q = (k, fallback = null) =>
  new URLSearchParams(location.search).get(k) ?? fallback;

/** ข้อความแจ้งชั่วคราวมุมล่างจอ */
export function toast(message, ms = 1800) {
  let box = document.querySelector('.toast');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toast';
    box.innerHTML = '<span></span>';
    document.body.append(box);
  }
  box.querySelector('span').textContent = message;
  box.dataset.show = 'true';
  clearTimeout(box._t);
  box._t = setTimeout(() => { box.dataset.show = 'false'; }, ms);
}

/** คัดลอกข้อความลงคลิปบอร์ด (มีทางถอยสำหรับเบราว์เซอร์ที่ไม่รองรับ) */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/**
 * ผูกปุ่ม "กดค้างเพื่อยืนยัน" — ปล่อยก่อนครบเวลา = ยกเลิก
 * ใช้กับการกระทำที่ย้อนกลับไม่ได้ ดีกว่าเด้งหน้าต่างถามซ้ำ
 */
export function bindHold(btn, { ms = 1000, onDone, onCancel } = {}) {
  let timer = null;
  const stop = (cancelled) => {
    if (timer) { clearTimeout(timer); timer = null; }
    btn.dataset.holding = 'false';
    btn.dataset.armed = 'false';
    if (cancelled && onCancel) onCancel();
  };
  const start = (e) => {
    if (btn.disabled) return;
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    btn.dataset.holding = 'true';
    btn.dataset.armed = 'true';
    timer = setTimeout(() => { stop(false); onDone?.(); }, ms);
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', () => stop(true));
  btn.addEventListener('pointercancel', () => stop(true));
  btn.addEventListener('pointerleave', () => stop(true));
  // คีย์บอร์ด: กดค้าง Enter/Space ก็ต้องได้เหมือนกัน
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !timer) {
      e.preventDefault();
      btn.dataset.holding = 'true';
      btn.dataset.armed = 'true';
      timer = setTimeout(() => { stop(false); onDone?.(); }, ms);
    }
  });
  btn.addEventListener('keyup', () => stop(true));
  return () => stop(true);
}

/** ใส่ปุ่มสลับธีมมุมบนให้ทุกหน้าตัวอย่าง (ของจริงไม่ต้องมี) */
export function mountThemeToggle(host) {
  const root = document.documentElement;
  const saved = localStorage.getItem('voucherkit.demo.theme');
  if (saved) {
    const [skin, mode] = saved.split('/');
    root.setAttribute('data-vk-skin', skin);
    root.setAttribute('data-vk-mode', mode);
  }
  const btn = document.createElement('button');
  btn.className = 'btn btn--quiet btn--auto';
  btn.style.minHeight = '34px';
  const paint = () => {
    btn.textContent = root.getAttribute('data-vk-mode') === 'dark' ? 'สว่าง' : 'มืด';
  };
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-vk-mode') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-vk-mode', next);
    localStorage.setItem('voucherkit.demo.theme', `${root.getAttribute('data-vk-skin')}/${next}`);
    paint();
  });
  paint();
  host.append(btn);
}

/* ══ ดีไซน์บัตรที่หน้าลูกค้าใช้ร่วมกัน ═══════════════════════════════════
   รวมไว้ที่เดียวเพราะ 3 หน้าต้องวาดบัตรให้ "หน้าตาเหมือนกันเป๊ะ"
   ถ้าแยกกันเขียน วันหนึ่งจะมีหน้าหนึ่งหลุดไปคนละแบบโดยไม่มีใครสังเกต */

/** ดีไซน์ที่ไท้เคาะแล้ว — ตั๋วฟอยล์ทอง */
export const CARD_DESIGN = 'foilticket';

/* ภาพงานเหล็กจริงที่ใช้เป็นพื้นหลังใบ — วนตามรหัสบัตร ไม่สุ่ม
   เพราะถ้าสุ่ม บัตรใบเดิมจะเปลี่ยนภาพทุกครั้งที่เปิดหน้า ซึ่งดูเหมือนระบบเพี้ยน */
const ARTS = ['stair', 'fence', 'gate', 'window', 'balcony'];

/** เลือกภาพพื้นหลังของบัตรใบหนึ่ง — ใบเดิมได้ภาพเดิมเสมอ */
export function artFor(v) {
  const s = String(v?.code || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ARTS[h % ARTS.length];
}

/** ตัวเลือกมาตรฐานสำหรับวาดบัตร 1 ใบ */
export const cardOpts = (v, shape = 'compact') => ({
  design: CARD_DESIGN,
  shape,
  art: artFor(v),
});

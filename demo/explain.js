/**
 * explain.js — "โหมดอธิบาย" สำหรับตอนพรีเซนต์
 * ---------------------------------------------------------------------------
 * ไท้สั่ง 2026-08-21: คำอธิบายไม่ควรอยู่หน้าแยก เพราะพอเจ้านายถาม
 * คนพรีเซนต์ต้องออกจากหน้าที่กำลังโชว์ ไปเปิดอีกหน้า หาหัวข้อ แล้วค่อยตอบ — จังหวะขาด
 * คำตอบต้องอยู่ "ตรงจุดที่มือกำลังทำอยู่" เช่นกำลังพิมพ์รหัส คำอธิบายเรื่องตัวตรวจทาน
 * ก็ต้องอยู่ใต้ช่องนั้นเลย
 *
 * วิธีใช้ — หน้าไหนอยากมี ใส่บรรทัดเดียว:
 *     import { mountExplain } from './explain.js';
 *     mountExplain([{ sel: '#codeIn', text: '...' }, ...]);
 *
 * ⚠️ เริ่มต้นเป็น "ปิด" เสมอ (ไท้เลือกเอง) — ฉากที่เป็นจุดว้าวต้องสะอาด ไม่มีตัวหนังสือรก
 *    พอเจ้านายเริ่มถามลึกค่อยกดเปิด แล้วคำอธิบายโผล่พร้อมกันทุกจุด
 *
 * ⚠️ ปุ่มสวิตช์ต้องแปะที่ <body> ตรง ๆ ห้ามอยู่ในกล่องของหน้า
 *    เพราะ position: fixed ที่อยู่ในกล่องที่ตัดขอบ (overflow: clip/hidden)
 *    Safari บน iPhone จะหยุดวาดทั้งกล่อง — บทเรียนเก่าของโปรเจกต์นี้
 */

const KEY = 'voucherkit.demo.explain';

const CSS = `
  .xp {
    margin: 7px 0 0;
    padding: 9px 11px;
    border-inline-start: 2px solid #c9a227;
    background: rgb(201 162 39 / 8%);
    border-radius: 0 6px 6px 0;
    color: #d9cba8;
    font: 400 12.5px/1.55 'Noto Sans Thai', system-ui, sans-serif;
    display: none;
  }
  .xp b { color: #f0e2bb; font-weight: 600; }
  body[data-explain='on'] .xp { display: block; }

  .xp-toggle {
    position: fixed;
    inset-block-end: calc(14px + env(safe-area-inset-bottom));
    inset-inline-end: 14px;
    z-index: 90;
    border: 1px solid #4a3a28;
    background: #1c1712;
    color: #e0c56b;
    font: 600 13px/1 'Noto Sans Thai', system-ui, sans-serif;
    padding: 11px 15px;
    min-height: 42px;
    border-radius: 999px;
    box-shadow: 0 6px 18px rgb(0 0 0 / 35%);
    cursor: pointer;
  }
  body[data-explain='on'] .xp-toggle { background: #c9a227; color: #1a1508; border-color: #c9a227; }
`;

let notes = [];
let toggle = null;

/** ใส่คำอธิบายลงไปติดกับของจริง — ข้ามอันที่ใส่ไปแล้ว */
function apply() {
  for (const n of notes) {
    const host = document.querySelector(n.sel);
    if (!host) continue;
    /* หน้าที่วาดใหม่ (เช่นหน้าร้านตอนกดตรวจ) จะล้างของเดิมทิ้ง ต้องใส่ซ้ำได้ */
    if (host.nextElementSibling?.classList?.contains('xp')) continue;
    const el = document.createElement('p');
    el.className = 'xp';
    el.innerHTML = n.text;
    host.after(el);
  }
}

function paint() {
  const on = document.body.dataset.explain === 'on';
  if (toggle) toggle.textContent = on ? 'ปิดคำอธิบาย' : 'โหมดอธิบาย';
}

/**
 * @param {{sel:string, text:string}[]} list จุดที่อยากให้มีคำอธิบาย
 */
export function mountExplain(list = []) {
  notes = list;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  /* จำไว้ข้ามหน้า — เดโมเดินหลายหน้าติดกัน ไม่ควรต้องกดเปิดใหม่ทุกหน้า */
  document.body.dataset.explain = localStorage.getItem(KEY) === 'on' ? 'on' : 'off';

  toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'xp-toggle';
  toggle.addEventListener('click', () => {
    const next = document.body.dataset.explain === 'on' ? 'off' : 'on';
    document.body.dataset.explain = next;
    localStorage.setItem(KEY, next);
    apply();
    paint();
  });
  document.body.append(toggle);

  apply();
  paint();

  /* หน้าที่วาดเนื้อหาใหม่ระหว่างใช้งาน (หน้าร้าน / บัตรใบเดียว) ต้องใส่คำอธิบายกลับเข้าไปเอง
     ไม่งั้นพอกดตรวจแล้วคำอธิบายจะหายไปทั้งชุด */
  let pending = 0;
  const watch = new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; apply(); });
  });
  watch.observe(document.body, { childList: true, subtree: true });
}

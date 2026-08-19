/**
 * card-fullscreen.js — "โหมดเต็มจอ" ของบัตรกำนัล
 * ---------------------------------------------------------------------------
 * แบบเดียวกับแอปบัตรประชาชน/บัตรเครดิต: กดแล้วบัตรขึ้นเต็มจอ
 * **ใบแนวยาวหมุนเอง 90° ให้พอดีจอแนวตั้ง** — ไม่สั่งให้ผู้ใช้หมุนเครื่อง
 *
 * ⚠️ ทำไมไม่สั่งให้หมุนเครื่อง (ไท้ทดสอบบน iPhone จริงแล้วทักมา 2026-08-19):
 *   · พอหมุนเป็นแนวนอน Safari หดพื้นที่จนเหลือเตี้ยมาก (390×699 เหลือราว 390×300)
 *   · คนส่วนใหญ่ **ล็อกหน้าจอแนวตั้งไว้อยู่แล้ว** สั่งให้หมุน = สร้างกำแพงให้ลูกค้า
 *   · แอปบัตรจริงไม่มีใครสั่งให้หมุนเครื่อง เขาหมุน "บัตร" ให้แทน
 *   ผู้ใช้จะเอียงเครื่องดูทีหลังก็ได้ — พอจอเป็นแนวนอน บัตรจะคืนเป็นแนวปกติเอง
 *
 * ⚠️ ห้ามใช้ position: fixed คลุมเต็มจอ — บน iOS มันวาดไม่ถึงก้นจอไม่ว่าสั่งเท่าไหร่
 *    (บทเรียนเก่าที่แก้กันมาหลายรอบ) จึงใช้บล็อกในสายเนื้อหา + ซ่อนของอื่นแทน
 *
 * ⚠️ ห้ามใช้ Fullscreen API ของเบราว์เซอร์ — iOS Safari ให้ใช้ได้เฉพาะกับวิดีโอ
 *    เรียกกับ element อื่นจะเงียบไปเฉย ๆ ไม่มี error
 */

const OPEN_ATTR = 'vkFullscreen';

/** ทรงที่ยาวกว่าสูงมาก ๆ ต้องหมุนตอนจอเป็นแนวตั้ง ทรงอื่นไม่ต้อง */
const ROTATES = new Set(['ticket', 'strip']);

let current = null;

function portrait() {
  return window.innerHeight >= window.innerWidth;
}

/**
 * เปิดบัตรเต็มจอ
 * @param {string} html   มาร์กอัปบัตรจาก cardHtml()
 * @param {{shape?:string, ratio?:number, onReady?:(card:HTMLElement, rotated:boolean)=>void, label?:string}} opt
 *        ratio = ความกว้างหารความสูงของใบ (ตั๋ว 2.6 · กระทัดรัด 0.82)
 * @returns {{close():void, el:HTMLElement}}
 */
export function openCardFullscreen(html, opt = {}) {
  if (current) current.close();

  const shape = opt.shape || 'ticket';
  const ratio = opt.ratio ?? (shape === 'ticket' ? 2.6 : 0.82);

  const el = document.createElement('div');
  el.className = 'vk-fs';
  el.dataset.shape = shape;
  el.innerHTML =
    `<div class="vk-fs__rot"><div class="vk-fs__card">${html}</div></div>` +
    `<button type="button" class="vk-fs__close" aria-label="ปิดโหมดเต็มจอ">✕</button>`;
  document.body.append(el);
  document.body.dataset[OPEN_ATTR] = '1';

  const rot = el.querySelector('.vk-fs__rot');
  const card = el.querySelector('.vk-card');
  let rotated = false;

  /* คำนวณความกว้างของใบให้ "ยาวสุดเท่าที่ยังพอดีจอ"
     หมุนแล้ว: ด้านยาวของใบไปกินความสูงจอ ด้านสั้นไปกินความกว้างจอ */
  const layout = () => {
    const W = el.clientWidth;
    const H = el.clientHeight;
    const turn = ROTATES.has(shape) && portrait();
    const w = turn ? Math.min(ratio * W, H) : Math.min(W, ratio * H);
    rot.style.width = `${Math.floor(w)}px`;
    rot.style.transform = `translate(-50%, -50%) rotate(${turn ? 90 : 0}deg)`;
    if (turn !== rotated) {
      rotated = turn;
      el.dataset.rotated = String(turn);
      opt.onReady?.(card, turn);
    }
  };

  layout();
  el.dataset.rotated = String(rotated);
  opt.onReady?.(card, rotated);

  const relayout = () => layout();
  window.addEventListener('resize', relayout, { passive: true });
  window.addEventListener('orientationchange', relayout, { passive: true });

  const onKey = (e) => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', onKey);

  const api = {
    el,
    card,
    close() {
      if (current !== api) return;
      current = null;
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      document.removeEventListener('keydown', onKey);
      delete document.body.dataset[OPEN_ATTR];
      el.remove();
      opt.onClose?.();
    },
  };
  el.querySelector('.vk-fs__close').onclick = () => api.close();
  current = api;
  return api;
}

/**
 * ติดปุ่ม "ดูเต็มจอ" ให้บัตรใบหนึ่งบนหน้าใช้งานจริง
 * แตะที่ใบก็เปิดได้ ไม่ต้องเล็งปุ่มเล็ก ๆ
 */
export function attachFullscreenButton(wrap, html, opt = {}) {
  if (!wrap) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vk-fs-open';
  btn.textContent = opt.label || 'ดูเต็มจอ';
  const open = () => openCardFullscreen(html, opt);
  btn.onclick = open;
  wrap.append(btn);
  /* แตะที่ตัวใบก็เปิด — แต่ต้องไม่ไปกินการลากนิ้วเอียงใบ จึงเช็คว่าไม่ได้ลาก */
  let moved = false;
  wrap.addEventListener('pointerdown', () => { moved = false; }, { passive: true });
  wrap.addEventListener('pointermove', () => { moved = true; }, { passive: true });
  wrap.addEventListener('click', (e) => { if (!moved && !e.target.closest('button, a')) open(); });
  return btn;
}

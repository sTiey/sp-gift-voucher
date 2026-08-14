/**
 * voucher-card.js — วาด "คูปอง 1 ใบ" ออกมาเป็น HTML
 * ---------------------------------------------------------------------------
 * ให้ 2 ทางเลือกใช้งาน เลือกอันที่เข้ากับงานที่มีอยู่:
 *
 *   1) แท็กสำเร็จรูป — เอาไปแปะในหน้าเว็บอะไรก็ได้ ไม่ต้องมี framework
 *        <gift-voucher layout="slab"></gift-voucher>
 *        el.voucher = { ... }
 *
 *   2) ฟังก์ชันวาด — เอาไปใช้ใน React / Vue / เอนจินเทมเพลตฝั่งเซิร์ฟเวอร์
 *        element.innerHTML = voucherCardHtml(voucher, { layout: 'strip' })
 *
 * ⚠️ ตั้งใจไม่ใช้ Shadow DOM
 *    เพราะอยากให้ทีมที่เอาไปใช้ "เขียน CSS ทับได้ตรง ๆ" ด้วย token
 *    ถ้าปิดใน Shadow DOM จะปรับแต่งยากขึ้นโดยไม่ได้อะไรกลับมา
 */

import { t } from '../core/strings.th.js';
import { valueParts, money, dateShort } from '../core/format.js';
import { deriveStatus, daysLeft, remainingUses } from '../core/lifecycle.js';

/** ป้ายสถานะควรเป็นสีอะไร */
const TONE = {
  active: 'ok',
  scheduled: 'warn',
  reserved: 'warn',
  redeemed: 'dead',
  expired: 'dead',
  void: 'dead',
  draft: 'dead',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/** บรรทัดเงื่อนไขใต้หัวข้อ เช่น "เมื่อซื้อครบ ฿10,000 · ลดสูงสุด ฿2,000" */
export function conditionLine(v) {
  const bits = [];
  if (v.conditions.minSpend) bits.push(`${t('card.minSpendPrefix')} ${money(v.conditions.minSpend)}`);
  if (v.conditions.maxDiscount) bits.push(`${t('card.maxDiscountPrefix')} ${money(v.conditions.maxDiscount)}`);
  // โชว์จำนวนสิทธิ์ที่เหลือเฉพาะตอนที่เป็น "ของแย่งกัน" จริง ๆ
  // ใบส่วนตัวที่มีสิทธิ์เดียวอยู่แล้ว เขียน "เหลืออีก 1 สิทธิ์" = รกเปล่า ๆ
  const left = remainingUses(v);
  if (left != null && left > 0 && v.limits.total > 1) {
    bits.push(`${t('card.remainingPrefix')} ${left} ${t('card.remainingSuffix')}`);
  }
  return bits.join(' · ');
}

/** คำกำกับเล็ก ๆ เหนือตัวเลข เช่น "ส่วนลด · พาร์ทเนอร์" */
export function kickerLine(v) {
  const bits = [t(`kind.${v.kind}`)];
  const segs = (v.audience.segments || []).filter((s) => s !== 'public');
  if (segs.length) bits.push(segs.map((s) => t(`segment.${s}`)).join('/'));
  return bits.join(' · ');
}

/** ข้อความวันหมดอายุ — เร่งให้รู้สึกเมื่อใกล้หมด */
export function expiryLine(v, now = Date.now()) {
  if (!v.validUntil) return { label: '', value: t('card.noExpiry'), urgent: false };
  const d = daysLeft(v, now);
  if (d != null && d < 0) return { label: t('card.expiresPrefix'), value: dateShort(v.validUntil), urgent: false };
  if (d === 0) return { label: '', value: t('card.expiresToday'), urgent: true };
  if (d != null && d <= 7) {
    return { label: '', value: `${t('card.daysLeftPrefix')} ${d} ${t('card.daysLeftSuffix')}`, urgent: true };
  }
  return { label: t('card.expiresPrefix'), value: dateShort(v.validUntil), urgent: false };
}

/** บล็อกตัวเลขมูลค่า — แยกไว้เพราะทั้ง 3 เลย์เอาต์ใช้ร่วมกัน */
function valueBlockHtml(v) {
  const p = valueParts(v);
  // "ส่งฟรี" เป็นคำ ไม่ใช่ตัวเลข ต้องบอก CSS ให้ย่อขนาดลง ไม่งั้นล้นใบ
  const isText = !/^[\d,.×]/.test(p.main);
  return `<div class="vk-card__value">
        ${p.lead ? `<span class="vk-card__lead">${esc(p.lead)}</span>` : ''}
        <span class="vk-card__num"${isText ? ' data-text="true"' : ''}>${esc(p.main)}</span>
        ${p.unit ? `<span class="vk-card__unit">${esc(p.unit)}</span>` : ''}
      </div>`;
}

/**
 * วาดคูปองเป็นสตริง HTML
 * @param {object} v คูปองตาม schema
 * @param {{layout?:'slab'|'strip'|'mini', clickable?:boolean, now?:number, hideCode?:boolean}} opt
 */
export function voucherCardHtml(v, opt = {}) {
  const layout = opt.layout || v.design?.layout || 'slab';
  const now = opt.now ?? Date.now();
  const status = deriveStatus(v, now);
  const exp = expiryLine(v, now);
  const accent = v.design?.accent ? `--vk-accent:${esc(v.design.accent)};` : '';

  const cardAttrs = [
    'class="vk-card"',
    `data-status="${esc(status)}"`,
    `data-kind="${esc(v.kind)}"`,
    `data-code="${esc(v.code)}"`,
    opt.clickable ? 'data-clickable="true"' : '',
    accent ? `style="${accent}"` : '',
  ].filter(Boolean).join(' ');

  const open = `<div class="vk-voucher" data-layout="${esc(layout)}">`;
  const close = '</div>';
  const pill = `<span class="vk-pill" data-tone="${TONE[status] || 'dead'}">${esc(t(`status.${status}`))}</span>`;
  const hit = opt.clickable
    ? `<button class="vk-card__hit" type="button" aria-label="${esc(v.title || v.code)}"></button>`
    : '';

  /* ---------- แบบรายการแนวนอน ---------- */
  if (layout === 'strip') {
    return `${open}<article ${cardAttrs}>
    <div class="vk-card__main">
      <div class="vk-card__sheen" aria-hidden="true"></div>
      ${valueBlockHtml(v)}
      <div class="vk-card__body">
        <p class="vk-card__kicker">${esc(kickerLine(v))}</p>
        <h3 class="vk-card__title">${esc(v.title || '')}</h3>
        <span class="vk-card__code">${esc(v.code)}</span>
      </div>
      <div class="vk-card__aside">
        ${pill}
        <span class="vk-card__date${exp.urgent ? ' is-urgent' : ''}">${esc(exp.value)}</span>
      </div>
      ${hit}
    </div>
  </article>${close}`;
  }

  /* ---------- แบบชิปเล็กในตะกร้า ---------- */
  if (layout === 'mini') {
    return `${open}<article ${cardAttrs}>
    <div class="vk-card__main">
      ${valueBlockHtml(v)}
      <span class="vk-card__code">${esc(v.code)}</span>
    </div>
  </article>${close}`;
  }

  /* ---------- แบบเต็มใบ ---------- */
  // โลโก้มีค่อยโชว์กล่องโลโก้ — ถ้าไม่มีก็โชว์แค่ชื่อ ไม่ต้องเอาอักษรย่อมาซ้ำกับชื่อ
  const brand = `<div class="vk-card__brand">
          ${v.brand?.logoUrl ? `<span class="vk-card__mark"><img src="${esc(v.brand.logoUrl)}" alt=""></span>` : ''}
          <span class="vk-card__brandname">${esc(v.brand?.name || '')}</span>
        </div>`;

  return `${open}<article ${cardAttrs}>
    <div class="vk-card__main">
      <div class="vk-card__sheen" aria-hidden="true"></div>
      ${v.design?.badge ? `<span class="vk-card__badge">${esc(v.design.badge)}</span>` : ''}
      <header class="vk-card__head">
        ${brand}
        ${pill}
      </header>
      <div class="vk-card__hero">
        <p class="vk-card__kicker">${esc(kickerLine(v))}</p>
        ${valueBlockHtml(v)}
        ${v.title ? `<h3 class="vk-card__title">${esc(v.title)}</h3>` : ''}
        ${conditionLine(v) ? `<p class="vk-card__cond">${esc(conditionLine(v))}</p>` : ''}
        ${v.note ? `<p class="vk-card__note">${esc(v.note)}</p>` : ''}
      </div>
    </div>
    <div class="vk-card__stub">
      <div>
        <span class="vk-label">${esc(t('card.codeLabel'))}</span>
        <span class="vk-card__code">${opt.hideCode ? '••••-••••-••••' : esc(v.code)}</span>
      </div>
      <div class="vk-card__meta">
        ${exp.label ? `<span class="vk-label">${esc(exp.label)}</span>` : ''}
        <span class="vk-card__date${exp.urgent ? ' is-urgent' : ''}">${esc(exp.value)}</span>
      </div>
    </div>
    ${hit}
  </article>${close}`;
}

/** วาดลงในกล่องที่มีอยู่ แล้วคืน element ของการ์ด */
export function renderVoucher(host, v, opt = {}) {
  host.innerHTML = voucherCardHtml(v, opt);
  return host.querySelector('.vk-card');
}

/* ══════════════════════ แท็กสำเร็จรูป <gift-voucher> ═══════════════════
   ⚠️ ต้องสร้างคลาสข้างในฟังก์ชัน ไม่ใช่ประกาศไว้ตรง ๆ ที่ระดับบนของไฟล์
   เพราะ `extends HTMLElement` จะถูกอ่านทันทีตอน import
   → ฝั่งเซิร์ฟเวอร์ (Node) ไม่มี HTMLElement = พังตั้งแต่ import ไฟล์นี้
   ซึ่งลาม ไป src/index.js ทั้งไฟล์ ทำให้เอาไปคิดเลขฝั่งหลังบ้านไม่ได้เลย
   (เคยพลาดมาแล้ว — เทสต์ไม่เจอเพราะไปเรียก core/ ตรง ๆ ไม่ผ่านประตูหน้าบ้าน) */

function defineElement() {
  if (typeof HTMLElement === 'undefined') return null;

  class GiftVoucher extends HTMLElement {
    static observedAttributes = ['layout', 'clickable', 'hide-code'];

    #data = null;

    set voucher(v) { this.#data = v; this.#draw(); }
    get voucher() { return this.#data; }

    connectedCallback() { this.#draw(); }
    attributeChangedCallback() { this.#draw(); }

    #draw() {
      if (!this.#data) return;
      this.innerHTML = voucherCardHtml(this.#data, {
        layout: this.getAttribute('layout') || undefined,
        clickable: this.hasAttribute('clickable'),
        hideCode: this.hasAttribute('hide-code'),
      });
    }
  }

  if (typeof customElements !== 'undefined' && !customElements.get('gift-voucher')) {
    customElements.define('gift-voucher', GiftVoucher);
  }
  return GiftVoucher;
}

/** คลาสของแท็ก `<gift-voucher>` — เป็น null เมื่อรันฝั่งเซิร์ฟเวอร์ */
export const GiftVoucherElement = defineElement();

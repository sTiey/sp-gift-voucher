/**
 * voucher-design.js — ตัววาดคูปองชุดใหม่ (ดีไซน์ 5 แบบ × 2 ทรง)
 * ---------------------------------------------------------------------------
 * แนวคิด: **โครง HTML ชุดเดียว ใช้ร่วมกันทุกดีไซน์**
 * ดีไซน์แต่ละแบบเปลี่ยนแค่ CSS — ซ่อนช่องที่ไม่ใช้ ย้ายตำแหน่ง เปลี่ยนสี/ฟอนต์
 * ทำแบบนี้เพราะ: เนื้อหาคูปองเหมือนกันหมด ต่างกันแค่ "วิธีนำเสนอ"
 * ถ้าแยกโครง HTML ต่อดีไซน์ เพิ่มฟีเจอร์ทีเดียวต้องไปแก้ 5 ที่
 *
 *   <div class="vk-voucher" data-design="seal" data-shape="ticket">
 *     <article class="vk-card" data-status="active" data-kind="percent">
 *       <figure class="vk-card__art">      ← ภาพสินค้า (ดีไซน์ไหนไม่ใช้ก็ซ่อน)
 *       <div class="vk-card__main">        ← เนื้อหาหลัก
 *       <aside class="vk-card__stub">      ← ก้านฉีก (ทรงยาว=ขวา · ทรงกระทัดรัด=ล่าง)
 *     </article>
 *   </div>
 *
 * 2 ทรง:
 *   ticket   ยาวแนวนอน มีก้านฉีกด้านขวา   → ส่ง LINE/อีเมล/จอคอม/พิมพ์
 *   compact  กระทัดรัด ก้านอยู่ด้านล่าง     → บนมือถือ · ในกระเป๋าคูปอง
 */

import { t } from '../core/strings.th.js';
import { valueParts, money, dateShort } from '../core/format.js';
import { deriveStatus, daysLeft, remainingUses } from '../core/lifecycle.js';
import { toSvg as qrSvg } from '../core/qr.js';
import { voucherUrl } from '../core/codes.js';

/** ดีไซน์ที่มีให้เลือก — เพิ่มแบบใหม่ = เติมที่นี่ + เขียนไฟล์ CSS 1 ไฟล์ */
export const DESIGNS = [
  { id: 'ironwindow', name: 'ช่องเหล็ก', family: 'brand', photo: true,
    blurb: 'ภาพงานเหล็กจริงเต็มพื้น แล้ววางแผ่นดำทับ · ขายด้วยของจริง' },
  { id: 'goldplate', name: 'แผ่นทอง', family: 'brand', photo: false,
    blurb: 'ดำสนิท ตัดเส้นทองบาง ๆ · กลิ่นบัตรสมาชิกระดับสูง' },
  /* ไอดี 'limeticket' เป็นชื่อตอนเริ่มร่าง (ตอนนั้นเป็นสีเขียว)
     ไท้เลือกทองเหลืองเป็นสีจริง 2026-08-14 — เขียวยังเรียกใช้ได้ด้วย accent:'lime' */
  { id: 'limeticket', name: 'ตั๋ว', family: 'brand', photo: true,
    blurb: 'กระดาษงาช้าง + ก้อนทองเหลือง + ก้านฉีกดำ · รหัสคูปองอยู่ในแถบดำใต้ตัวเลข' },
];

/** ภาพสินค้าที่มีให้ใช้ */
export const PRODUCT_ART = ['stair', 'gate', 'balcony', 'fence', 'window'];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const TONE = {
  active: 'ok', scheduled: 'warn', reserved: 'warn',
  redeemed: 'dead', expired: 'dead', void: 'dead', draft: 'dead',
};

function conditionLine(v) {
  const bits = [];
  if (v.conditions.minSpend) bits.push(`${t('card.minSpendPrefix')} ${money(v.conditions.minSpend)}`);
  if (v.conditions.maxDiscount) bits.push(`${t('card.maxDiscountPrefix')} ${money(v.conditions.maxDiscount)}`);
  const left = remainingUses(v);
  if (left != null && left > 0 && v.limits.total > 1) {
    bits.push(`${t('card.remainingPrefix')} ${left} ${t('card.remainingSuffix')}`);
  }
  return bits.join(' · ');
}

function kickerLine(v) {
  const bits = [t(`kind.${v.kind}`)];
  const segs = (v.audience.segments || []).filter((s) => s !== 'public');
  if (segs.length) bits.push(segs.map((s) => t(`segment.${s}`)).join('/'));
  return bits.join(' · ');
}

function expiryLine(v, now) {
  if (!v.validUntil) return { label: '', value: t('card.noExpiry'), urgent: false };
  const d = daysLeft(v, now);
  if (d === 0) return { label: '', value: t('card.expiresToday'), urgent: true };
  if (d != null && d > 0 && d <= 7) {
    return { label: '', value: `${t('card.daysLeftPrefix')} ${d} ${t('card.daysLeftSuffix')}`, urgent: true };
  }
  return { label: t('card.expiresPrefix'), value: dateShort(v.validUntil), urgent: false };
}

/**
 * วาดคูปอง 1 ใบ
 * @param {object} v คูปองตาม schema
 * @param {{design?:string, shape?:'ticket'|'compact', accent?:string, variant?:string, art?:string, qr?:boolean, now?:number}} opt
 */
export function cardHtml(v, opt = {}) {
  const design = opt.design || 'ironwindow';
  const shape = opt.shape || 'compact';
  const now = opt.now ?? Date.now();
  const status = deriveStatus(v, now);
  const parts = valueParts(v);
  const exp = expiryLine(v, now);
  // ค่าเป็นคำ (เช่น "ส่งฟรี") ไม่ใช่ตัวเลข → ดีไซน์ต้องย่อขนาดและห้ามให้ถูกบัง
  const isText = !/^[\d,.×]/.test(parts.main);

  const artSlug = opt.art || 'balcony';
  const artFile = `../assets/products/${artSlug}-${shape === 'ticket' ? 'wide' : 'square'}.jpg`;

  const qr = opt.qr === false ? '' :
    `<div class="vk-card__qr" aria-hidden="true">${qrSvg(voucherUrl(v.code, 'https://spempire.co.th/v'), {
      dark: 'currentColor', light: 'none', quiet: 1,
    })}</div>`;

  // ไท้เลือกทองเหลืองเป็นสีจริงของคูปอง (2026-08-14) — เขียวยังเรียกใช้ได้ด้วย accent:'lime'
  const accent = ` data-accent="${esc(opt.accent || 'gold')}"`;
  const variant = opt.variant ? ` data-variant="${esc(opt.variant)}"` : '';

  return `<div class="vk-voucher" data-design="${esc(design)}" data-shape="${esc(shape)}"${accent}${variant}>
  <article class="vk-card" data-status="${esc(status)}" data-kind="${esc(v.kind)}" data-code="${esc(v.code)}">

    <figure class="vk-card__art">
      <!-- ⚠️ ห้ามใส่ loading="lazy" ที่นี่
           ภาพที่ยังไม่ถูกเลื่อนไปถึงจะไม่โหลด → ตอนแคปหน้าจอตรวจงาน
           ดีไซน์ที่ใช้ภาพจะกลายเป็นช่องว่างเปล่า แล้วเข้าใจผิดว่าดีไซน์พัง -->
      <img src="${esc(artFile)}" alt="" decoding="async">
    </figure>

    <div class="vk-card__main">
      <header class="vk-card__head">
        <span class="vk-card__logo"><img src="../assets/brand/spe-mark.png" alt="SP Empire"></span>
        <span class="vk-card__brandname">SP EMPIRE</span>
        <span class="vk-card__pill" data-tone="${TONE[status] || 'dead'}">${esc(t(`status.${status}`))}</span>
      </header>

      <div class="vk-card__hero">
        <p class="vk-card__kicker">${esc(kickerLine(v))}</p>
        <p class="vk-card__value" data-code="${esc(v.code)}">
          ${parts.lead ? `<span class="vk-card__lead">${esc(parts.lead)}</span>` : ''}
          <span class="vk-card__num" data-len="${parts.main.length}"${isText ? ' data-text="true"' : ''}>${esc(parts.main)}</span>
          ${parts.unit ? `<span class="vk-card__unit">${esc(parts.unit)}</span>` : ''}
        </p>
        <h3 class="vk-card__title">${esc(v.title || '')}</h3>
        ${conditionLine(v) ? `<p class="vk-card__cond">${esc(conditionLine(v))}</p>` : ''}
        ${v.note ? `<p class="vk-card__note">${esc(v.note)}</p>` : ''}
      </div>

      ${v.design?.badge ? `<span class="vk-card__badge">${esc(v.design.badge)}</span>` : ''}
    </div>

    <aside class="vk-card__stub">
      ${qr}
      <div class="vk-card__stub-body">
        <span class="vk-card__label">${esc(t('card.codeLabel'))}</span>
        <span class="vk-card__code">${esc(v.code)}</span>
        <span class="vk-card__label">${esc(exp.label || t('card.expiresPrefix'))}</span>
        <span class="vk-card__date${exp.urgent ? ' is-urgent' : ''}">${esc(exp.value)}</span>
      </div>
      <span class="vk-card__serial">${esc(v.code.replace(/-/g, ' '))}</span>
    </aside>

  </article>
</div>`;
}

/** วาดลงกล่องที่มีอยู่ */
export function render(host, v, opt = {}) {
  host.innerHTML = cardHtml(v, opt);
  return host.querySelector('.vk-card');
}

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

/** ดีไซน์ที่มีให้เลือก — เพิ่มแบบใหม่ = เติมที่นี่ + เขียนไฟล์ CSS 1 ไฟล์
 *  shapes = ทรงที่เขียน CSS ไว้จริง · หน้ารวมดีไซน์ใช้ค่านี้ตัดสินว่าจะวาดทรงไหน
 *  ⚠️ ใส่ทรงที่ยังไม่ได้เขียน CSS = ใบนั้นออกมาเป็นโครงเปล่า ดูเหมือนดีไซน์พัง */
export const DESIGNS = [
  { id: 'ironwindow', name: 'ช่องเหล็ก', family: 'brand', photo: true, shapes: ['ticket', 'compact'],
    blurb: 'ภาพงานเหล็กจริงเต็มพื้น แล้ววางแผ่นดำทับ · ขายด้วยของจริง' },
  { id: 'goldplate', name: 'แผ่นทอง', family: 'brand', photo: false, shapes: ['ticket', 'compact'],
    blurb: 'ดำสนิท ตัดเส้นทองบาง ๆ · กลิ่นบัตรสมาชิกระดับสูง' },
  /* ไอดี 'limeticket' เป็นชื่อตอนเริ่มร่าง (ตอนนั้นเป็นสีเขียว)
     ไท้เคาะ 2026-08-17: ทองเหลืองสีเดียว — เขียวถูกตัดออกจากโค้ดแล้ว */
  { id: 'limeticket', name: 'ตั๋ว', family: 'brand', photo: true, shapes: ['ticket', 'compact'],
    blurb: 'กระดาษงาช้าง + ก้อนทองเหลือง + ก้านฉีกดำ · รหัสคูปองอยู่ในแถบดำใต้ตัวเลข' },

  /* ชุดใหม่ 2026-08-17 — ไท้ขอผสมความเป็นตั๋วจริง (เส้นปรุ · ก้านฉีก · ดูโอโทน)
     ในสไตล์โมเดิร์นอาร์ต คลีน ๆ · ทำทรงยาวก่อนอย่างเดียว รอไท้เลือกก่อนขยาย */
  { id: 'stubline', name: 'เส้นปรุ', family: 'modern', photo: true, shapes: ['ticket'],
    blurb: 'โครงตั๋วจริงแบบสวิส · ตัวเลขคร่อมเส้นปรุ ฉีกก้านออกแล้วเลขขาดครึ่ง' },
  { id: 'arcdisc', name: 'จานทอง', family: 'modern', photo: true, shapes: ['ticket'],
    blurb: 'รูปทรงนำ · วงกลมทองวงเดียวเป็นบ้านของตัวเลข ยื่นล้ำขอบใบ' },
  { id: 'slantset', name: 'เอียง', family: 'modern', photo: true, shapes: ['ticket'],
    blurb: 'ตัวหนังสือนำ · ชื่อคูปองเอียง 12° พาดขวางใบที่ตรงเป๊ะทั้งใบ' },

  /* ทิศทางที่ไท้เคาะเอง 2026-08-17 จากภาพอ้างอิงที่ส่งมา */
  { id: 'foilticket', name: 'ตั๋วฟอยล์ทอง', family: 'modern', photo: false, shapes: ['ticket', 'compact'],
    blurb: 'กระดาษงาช้าง ตัวหนังสือน้ำตาล · ตัวเลขปั๊มฟอยล์ทองเป็นของมันวาวชิ้นเดียวในใบ · ก้านฉีก 30%' },
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

/**
 * คืนเงื่อนไขเป็น "รายชิ้น" ไม่ใช่สายเดียวที่ต่อกันแล้ว
 * ⚠️ ทำไมถึงต้องแยก: **ภาษาไทยไม่มีช่องไฟระหว่างคำ**
 *    เบราว์เซอร์จึงตัดขึ้นบรรทัดกลางคำได้ — เจอจริง: "ลด" บรรทัดหนึ่ง "สูงสุด ฿2,000" อีกบรรทัด
 *    `word-break: keep-all` **ไม่ช่วย** (ลองแล้ว Chrome ยังตัดอยู่)
 *    ทางที่ได้ผลคือห่อแต่ละข้อด้วย span ที่สั่งห้ามขึ้นบรรทัด → ตัดได้เฉพาะตรงตัวคั่น
 */
function conditionBits(v) {
  const bits = [];
  if (v.conditions.minSpend) bits.push({ label: t('card.minSpendPrefix'), value: money(v.conditions.minSpend) });
  if (v.conditions.maxDiscount) bits.push({ label: t('card.maxDiscountPrefix'), value: money(v.conditions.maxDiscount) });
  const left = remainingUses(v);
  if (left != null && left > 0 && v.limits.total > 1) {
    bits.push({ label: t('card.remainingPrefix'), value: `${left} ${t('card.remainingSuffix')}` });
  }
  return bits;
}

/**
 * ข้อความสั้นๆ บนสันก้านฉีก — ย้ำอีกทีว่าใบนี้คือโปรอะไร (ไท้สั่ง)
 * สั้นเพราะมันต้องหมุนตั้ง — ยาวไปกว่านี้จะเกินความสูงก้าน
 * "ส่งฟรี" ไม่ต้องต่อตัวเลข — ชื่อชนิดกับค่าเป็นคำเดียวกัน ไม่งั้นได้ "ส่งฟรี ส่งฟรี"
 */
function spineText(v) {
  const p = valueParts(v);
  const head = t(`kind.${v.kind}`);
  if (v.kind === 'free_shipping') return head;
  return `${head} ${p.lead}${p.main}${p.unit}`;
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
 * @param {{design?:string, shape?:'ticket'|'compact', variant?:string, art?:string, qr?:boolean, now?:number}} opt
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

  const artSlug = opt.art || 'fence';
  /* ภาพพื้นหลังของใบ — เป็นคนละไฟล์กับภาพสินค้าเต็ม เพราะย่อมาหนัก 1 ใน 8

     ⚠️ **กับดักที่เสียเวลาไปจริง**: url() ที่อยู่ในตัวแปร CSS
        ถึงจะเขียนไว้ใน style ของหน้าเว็บ แต่ Chrome กลับไปอ้างอิงกับ
        **ที่อยู่ของไฟล์ CSS ที่เอาค่านั้นไปใช้** — พาที่เลยกลายเป็น /src/styles/assets/...
        ภาพจึงโหลดไม่ขึ้น โดยที่หน้าไม่ฟ้องอะไรเลย (เสียเวลาไล่อยู่พักหนึ่ง)
        → แก้ด้วยการ **คลี่ที่อยู่ให้เต็มตั้งแต่ใน JS** จะได้ไม่ขึ้นกับว่าใครเป็นคนตีความ */
  const artPath = `../assets/products/bg/${artSlug}.webp`;
  const artUrl = typeof document !== 'undefined'
    ? new URL(artPath, document.baseURI).href
    : artPath;
  /* ⚠️ ใบที่ตายแล้วต้องตัดภาพที่นี่ — เคยไปเขียนทับใน CSS แล้วไม่มีผล
     เพราะ style ที่ติดกับหน้าชนะกฎในไฟล์ CSS เสมอ ไม่ว่ากฎนั้นจะเจาะจงแค่ไหน */
  const artBg = TONE[status] === 'dead' ? '' : `--ft-art:url('${esc(artUrl)}')`;
  const artFile = `../assets/products/${artSlug}-${shape === 'ticket' ? 'wide' : 'square'}.jpg`;

  const qr = opt.qr === false ? '' :
    `<div class="vk-card__qr" aria-hidden="true">${qrSvg(voucherUrl(v.code, 'https://spempire.co.th/v'), {
      dark: 'currentColor', light: 'none', quiet: 1,
    })}</div>`;

  /* แต่ละข้อห่อ span ของตัวเอง คั่นด้วยจุดกลางที่ขึ้นบรรทัดได้จุดเดียว */
  const conds = conditionBits(v)
    .map((b) => `<span class="vk-card__cond-part">`
      + `<span class="vk-card__cond-label">${esc(b.label)}</span> `
      + `<span class="vk-card__cond-value">${esc(b.value)}</span></span>`)
    .join('<span class="vk-card__cond-sep"> · </span>');

  /* ทรงของตัวเลขตัดสินผังทั้งใบ (ไท้สั่ง 2026-08-18):
     เปอร์เซ็นต์สั้นแค่ 1-3 ตัว → สูงแต่แคบ → ข้อความอยู่ข้างได้
     จำนวนเงินมีลูกน้ำกับจุลภาค → เตี้ยแต่กว้าง → ต้องกินความกว้างเต็ม แล้วเอาข้อความไปไว้ใต้
     ยัดทั้งคู่เข้าผังเดียว = ใบหนึ่งตัวเลขเล็กเกินไป อีกใบชนเส้นปรุ — เป็นสิ่งที่เจอมาจริง */
  const numShape = (v.kind === 'percent' || parts.main.length <= 2) ? 'tall' : 'wide';

  /* ⚠️ ดีไซน์ที่ไม่ใช้ภาพสินค้า ต้อง **ไม่สร้างแท็ก <img> เลย** ไม่ใช่แค่ซ่อนด้วย CSS
     เพราะ `display: none` **ไม่หยุดการดาวน์โหลดภาพ** — วัดจริงแล้วเสียเปล่า 105 KB ต่อใบ
     มากกว่าภาพพื้นหลังที่ใช้จริง (14 KB) เจ็ดเท่า · งานนี้เน้นมือถือ จึงเป็นเรื่อใหญ่ */
  const usesPhoto = (DESIGNS.find((d) => d.id === design) || {}).photo !== false;
  const art = usesPhoto
    ? `<figure class="vk-card__art"><img src="${esc(artFile)}" alt="" decoding="async"></figure>`
    : '';

  const variant = opt.variant ? ` data-variant="${esc(opt.variant)}"` : '';

  return `<div class="vk-voucher" data-design="${esc(design)}" data-shape="${esc(shape)}"${variant}>
  <article class="vk-card" data-status="${esc(status)}" data-kind="${esc(v.kind)}" data-numshape="${numShape}" data-code="${esc(v.code)}" style="${artBg}">

    ${art}

    <div class="vk-card__main">
      <header class="vk-card__head">
        <span class="vk-card__logo"><img src="../assets/brand/spe-mark.webp" alt="SP Empire"></span>
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
        ${conds.length ? `<p class="vk-card__cond">${conds}</p>` : ''}
        ${v.note ? `<p class="vk-card__note">${esc(v.note)}</p>` : ''}
      </div>

      ${v.design?.badge ? `<span class="vk-card__badge">${esc(v.design.badge)}</span>` : ''}
    </div>

    <!-- ชั้นเคลือบมันของกระดาษ — ดีไซน์ไหนไม่ใช้ก็ซ่อนไว้ ไม่มีเนื้อหา -->
    <span class="vk-card__sheen" aria-hidden="true"></span>

    <aside class="vk-card__stub">
      ${qr}
      <span class="vk-card__scan">${esc(t('card.scanHint'))}</span>
      <span class="vk-card__spine">${esc(spineText(v))}</span>
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

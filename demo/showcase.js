/**
 * showcase.js — ตัวขับหน้ารวมตัวอย่าง (ไม่ใช่ส่วนหนึ่งของระบบ)
 */

import {
  createVoucher, voucherCardHtml, qrSvg, voucherUrl, deriveStatus, t,
} from '../src/index.js';

const $ = (s) => document.querySelector(s);

/* เปิดหน้านี้พร้อมธีมที่ต้องการได้เลย เช่น  index.html?skin=ink&mode=light
   (ไว้เทียบธีมโดยไม่ต้องนั่งกดทีละปุ่ม) */
{
  const q = new URLSearchParams(location.search);
  const skin = q.get('skin');
  const mode = q.get('mode');
  if (skin) document.documentElement.setAttribute('data-vk-skin', skin);
  if (mode) document.documentElement.setAttribute('data-vk-mode', mode);
  for (const b of document.querySelectorAll('#skinSeg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.skin === (skin || 'steel')));
  }
  for (const b of document.querySelectorAll('#modeSeg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === (mode || 'dark')));
  }
}

/* ---- โหลดข้อมูลตัวอย่าง ---- */
const raw = await (await fetch('../data/vouchers.sample.json')).json();
const vouchers = raw.map(createVoucher);

/* ---- 01 · ใบเต็ม ---- */
$('#slabGrid').innerHTML = vouchers
  .map((v) => `<div class="sc-item">
      ${voucherCardHtml(v, { layout: 'slab' })}
      <span class="sc-item__cap">${v.kind} · ${deriveStatus(v)}</span>
    </div>`)
  .join('');

/* ---- 02 · แบบรายการ ---- */
$('#stripList').innerHTML = vouchers
  .slice(0, 5)
  .map((v) => voucherCardHtml(v, { layout: 'strip', clickable: true }))
  .join('');

/* ---- 03 · แบบชิป ---- */
$('#chipRow').innerHTML = vouchers
  .slice(0, 4)
  .map((v) => voucherCardHtml(v, { layout: 'mini' }))
  .join('');

/* ---- 04 · QR + ตัวอย่างโค้ด ---- */
const demo = vouchers[0];
const url = voucherUrl(demo.code, 'https://shop.example.com/voucher.html');
function paintQr() {
  const cs = getComputedStyle(document.documentElement);
  $('#qrBox').innerHTML = qrSvg(url, {
    dark: cs.getPropertyValue('--vk-qr-dark').trim(),
    light: 'none',
  });
}
$('#qrCap').textContent = `${demo.code} · ${url.length} ตัวอักษร`;

$('#apiSample').innerHTML = `<b>// ออกคูปอง 500 ใบให้พาร์ทเนอร์</b>
const svc = new VoucherService(new LocalStore());
await svc.issue({
  kind: 'percent', value: 15,
  title: 'ส่วนลดพาร์ทเนอร์',
  conditions: { minSpend: 10000, maxDiscount: 2000 },
  audience: { segments: ['partner'] },
  validUntil: '2026-12-31T23:59:59+07:00',
}, { count: 500, prefix: 'SPE' });

<b>// ตอนลูกค้าจะจ่ายเงิน</b>
const r = await svc.check(codeThatCustomerTyped, {
  orderTotal: 24000, segments: ['partner'], channel: 'web',
});
r.ok          <b>// true</b>
r.discount    <b>// 2000  (ชนเพดานพอดี)</b>
r.payable     <b>// 22000</b>`;

/* ---- 05 · โทเคนสี ---- */
const TOKENS = [
  '--vk-bg-page', '--vk-bg-surface', '--vk-bg-card', '--vk-bg-card-2',
  '--vk-ink', '--vk-ink-muted', '--vk-ink-faint',
  '--vk-accent', '--vk-ok', '--vk-warn', '--vk-dead',
];
function paintTokens() {
  const cs = getComputedStyle(document.documentElement);
  $('#tokenGrid').innerHTML = TOKENS.map((name) => {
    const val = cs.getPropertyValue(name).trim();
    return `<div class="sc-swatch">
        <div class="sc-swatch__chip" style="background:${val}"></div>
        <span class="sc-swatch__name">${name}</span>
        <span class="sc-swatch__val">${val}</span>
      </div>`;
  }).join('');
}

/* ---- แถบควบคุม ---- */
function wireSeg(sel, attr) {
  const box = $(sel);
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === btn));
    document.documentElement.setAttribute(attr, btn.dataset.skin || btn.dataset.mode);
    // รอให้ค่า token ใหม่ผลบังคับใช้ก่อนค่อยอ่านสีไปวาดใหม่
    requestAnimationFrame(() => { paintTokens(); paintQr(); });
  });
}
wireSeg('#skinSeg', 'data-vk-skin');
wireSeg('#modeSeg', 'data-vk-mode');

paintTokens();
paintQr();

/* กันคำแปลหาย: ถ้าลืมใส่คำใน strings จะเห็นเป็นคีย์ดิบบนจอทันที */
console.info('[showcase] ตัวอย่าง', vouchers.length, 'ใบ ·', t('wallet.title'));
